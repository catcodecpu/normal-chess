const chess = new Chess();
const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const turnEl = document.getElementById("turn");
const messageEl = document.getElementById("message");
const roomStatusEl = document.getElementById("roomStatus");
const cheatStatusEl = document.getElementById("cheatStatus");
let selected = null, spawnMode = false, cheatMode = null;
let isHost = true; // Local play is yours; room creator remains host in this starter.
let supabase = null, channel = null, roomCode = null, applyingRemote = false;
const glyph = {wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};

function render(){
  boardEl.innerHTML = "";
  const board = chess.board();
  const legalTargets = selected ? chess.moves({square:selected,verbose:true}).map(m=>m.to) : [];
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const sq = String.fromCharCode(97+c)+(8-r), piece = board[r][c];
    const el = document.createElement("button");
    el.className = `square ${(r+c)%2===0?"light":"dark"}${selected===sq?" selected":""}${legalTargets.includes(sq)?" target":""}${piece&&legalTargets.includes(sq)?" capture":""}`;
    el.type="button"; el.setAttribute("aria-label",sq+(piece?` ${piece.color} ${piece.type}`:""));
    if(piece) el.textContent = glyph[piece.color+piece.type];
    el.addEventListener("click",()=>onSquare(sq));
    boardEl.appendChild(el);
  }
  const turn = chess.turn()==="w"?"White":"Black";
  statusEl.textContent = chess.isCheckmate() ? `Checkmate — ${turn==="White"?"Black":"White"} wins` : chess.isDraw() ? "Draw" : `${turn} to move${chess.isCheck()?" · Check":""}`;
  turnEl.textContent = turn.toUpperCase();
}
function setMessage(t){messageEl.textContent=t}
function publish(){
  if(channel && !applyingRemote) channel.send({type:"broadcast",event:"position",payload:{fen:chess.fen(),history:chess.history()}});
}
function onSquare(sq){
  if(spawnMode){ if(chess.get(sq)){setMessage("Choose an empty square to spawn.");return;} const [color,type]=document.getElementById("spawnPiece").value; chess.put({color,type},sq); finishCheat(`Spawned ${color==="w"?"White":"Black"} ${type.toUpperCase()} on ${sq}.`);return;}
  if(cheatMode==="delete"){if(chess.get(sq)){chess.remove(sq);finishCheat(`Removed ${sq}.`)}else setMessage("That square is empty.");return;}
  if(cheatMode==="queen"){const p=chess.get(sq);if(p){chess.put({color:p.color,type:"q"},sq);finishCheat("Piece upgraded to a queen.")}return;}
  if(cheatMode==="teleport"){
    if(!selected){if(chess.get(sq)){selected=sq;setMessage("Now choose an empty destination.");render()}return;}
    if(!chess.get(sq)){const p=chess.remove(selected);chess.put(p,sq);finishCheat("Piece teleported.")}return;
  }
  if(selected){
    try{
      const move=chess.move({from:selected,to:sq,promotion:"q"});
      if(move){selected=null;render();setMessage(`${move.color==="w"?"White":"Black"} played ${move.san}.`);publish();return;}
    }catch(e){}
  }
  if(chess.get(sq)&&chess.get(sq).color===chess.turn()){selected=sq;setMessage("Choose a highlighted destination.");}
  else selected=null;
  render();
}
function finishCheat(text){selected=null;cheatMode=null;spawnMode=false;document.getElementById("spawnModeBtn").textContent="Spawn piece: OFF";render();setMessage(text);publish()}
function hostOnly(){
  if(!isHost){setMessage("Only the room host can use cheats.");return false;}
  return true;
}
document.getElementById("spawnModeBtn").onclick=()=>{if(!hostOnly())return;spawnMode=!spawnMode;cheatMode=null;selected=null;document.getElementById("spawnModeBtn").textContent=`Spawn piece: ${spawnMode?"ON":"OFF"}`;setMessage(spawnMode?"Choose an empty square to spawn your selected piece.":"Spawner disabled.");render()};
document.querySelectorAll("[data-cheat]").forEach(btn=>btn.onclick=()=>{
  if(!hostOnly())return;
  const cheat=btn.dataset.cheat;selected=null;spawnMode=false;document.getElementById("spawnModeBtn").textContent="Spawn piece: OFF";
  if(cheat==="delete"||cheat==="teleport"||cheat==="queen"){cheatMode=cheat;setMessage(cheat==="delete"?"Click a piece to delete it.":cheat==="teleport"?"Click a piece, then an empty destination.":"Click a piece to turn it into a queen.");render();return;}
  if(cheat==="clear"){for(let r=0;r<8;r++)for(let c=0;c<8;c++){const sq=String.fromCharCode(97+c)+(8-r),p=chess.get(sq);if(p&&p.type!=="k")chess.remove(sq)}finishCheat("All non-king pieces cleared.");}
  if(cheat==="extraQueens"){for(const sq of ["a3","c3","e3","g3","b6","d6","f6","h6"])if(!chess.get(sq))chess.put({color:"w",type:"q"},sq);finishCheat("Queen army deployed.");}
  if(cheat==="moveAnywhere"){setMessage("Move-anywhere is a prototype toggle placeholder; use Teleport for unrestricted repositioning.");}
});
document.getElementById("undoBtn").onclick=()=>{chess.undo();selected=null;render();publish();setMessage("Last move undone.")};
document.getElementById("resetBtn").onclick=()=>{chess.reset();selected=null;render();publish();setMessage("Board restarted.")};

function connectSupabase(){
  const url=document.getElementById("supabaseUrl").value.trim(),key=document.getElementById("supabaseKey").value.trim();
  if(!url||!key){roomStatusEl.textContent="Enter your Supabase project URL and anon key first.";return null;}
  if(!window.supabase){roomStatusEl.textContent="Supabase library did not load. Check your internet connection.";return null;}
  return window.supabase.createClient(url,key);
}
function randomCode(){return Math.random().toString(36).slice(2,8).toUpperCase()}
async function openRoom(code,host){
  supabase=connectSupabase();if(!supabase)return;
  roomCode=code;isHost=host;
  if(channel)await supabase.removeChannel(channel);
  channel=supabase.channel("normal-chess-"+code,{config:{broadcast:{self:false}}});
  channel.on("broadcast",{event:"position"},({payload})=>{
    if(!payload?.fen)return;
    try{applyingRemote=true;chess.load(payload.fen);selected=null;render();setMessage("Opponent updated the board.");}catch(e){setMessage("Received an invalid board position.");}finally{applyingRemote=false;}
  }).subscribe((state)=>{
    if(state==="SUBSCRIBED"){
      roomStatusEl.textContent=`Connected to room ${code}. ${host?"You are the host (admin).":"You joined as guest."}`;
      cheatStatusEl.textContent=host?"Admin cheats enabled for you.":"Cheats are host-only.";
      if(host)publish();
    }else roomStatusEl.textContent=`Room status: ${state}`;
  });
}
document.getElementById("createRoomBtn").onclick=()=>{const code=randomCode();document.getElementById("roomCode").value=code;openRoom(code,true)};
document.getElementById("joinRoomBtn").onclick=()=>{const code=document.getElementById("roomCode").value.trim().toUpperCase();if(!code){roomStatusEl.textContent="Enter a room code.";return}openRoom(code,false)};
render();
