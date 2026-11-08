// NORMAL CHESS — CHAOS EDITION
// Custom SVG pieces + hidden cheats + multiplayer

if (typeof Chess === "undefined") {
    alert("Chess library failed to load.");
    throw new Error("Chess library missing.");
}

const game = new Chess();

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const messageEl = document.getElementById("message");
const roomStatusEl = document.getElementById("roomStatus");
const adminPanel = document.getElementById("adminPanel");

let selected = null;
let possibleMoves = [];
let sbClient = null;
let roomChannel = null;
let playerColor = null;
let roomCode = null;
let adminMode = false;
let adminAction = null;
let cloneSource = null;

const ADMIN_PASSWORD = "1234";

const pieceNames = {
    k: "King", q: "Queen", r: "Rook",
    b: "Bishop", n: "Knight", p: "Pawn"
};

// --------------------------------------------------
// CUSTOM CHESS PIECE ART
// --------------------------------------------------

function pieceSVG(piece) {
    const white = piece.color === "w";
    const fill = white ? "#f8f5eb" : "#353535";
    const stroke = white ? "#746d60" : "#101010";
    const shine = white ? "#ffffff" : "#666666";

    const shapes = {
        p: `
            <circle cx="50" cy="25" r="12"/>
            <path d="M42 38 Q35 49 39 60 L29 77
                     Q50 84 71 77 L61 60 Q65 49 58 38 Z"/>
        `,
        r: `
            <path d="M28 22 H39 V31 H44 V22 H56 V31
                     H61 V22 H72 V43 H67 L69 70
                     L78 78 H22 L31 70 L33 43 H28 Z"/>
        `,
        n: `
            <path d="M27 76 Q30 62 36 54
                     Q29 42 37 30 Q47 18 62 24
                     L75 38 L68 47 Q61 41 55 45
                     Q49 51 61 58 L72 76 Z"/>
            <circle cx="59" cy="34" r="2" fill="${shine}"/>
        `,
        b: `
            <path d="M50 13 Q68 23 57 39
                     Q53 46 62 56 L70 75
                     H30 L38 56 Q47 46 43 39
                     Q32 23 50 13 Z"/>
            <path d="M42 32 L58 22" stroke="${stroke}"
                  stroke-width="4" fill="none"/>
        `,
        q: `
            <circle cx="29" cy="25" r="6"/>
            <circle cx="50" cy="17" r="6"/>
            <circle cx="71" cy="25" r="6"/>
            <path d="M25 33 L34 58 H66 L75 33
                     L61 45 L50 29 L39 45 Z"/>
            <path d="M34 58 H66 L72 77 H28 Z"/>
        `,
        k: `
            <path d="M44 13 H56 V27 H69 V38 H56
                     V53 L68 69 H32 L44 53 V38
                     H31 V27 H44 Z"/>
            <path d="M29 69 H71 L78 79 H22 Z"/>
        `
    };

    return `
    <svg class="chess-piece" viewBox="0 0 100 100"
         xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="50" cy="88" rx="29" ry="5"
                 fill="#000" opacity=".25"/>
        <g fill="${fill}" stroke="${stroke}"
           stroke-width="3" stroke-linejoin="round">
            ${shapes[piece.type]}
            <path d="M24 78 Q50 86 76 78 L80 87
                     Q50 96 20 87 Z"/>
        </g>
        <path d="M35 75 Q50 80 65 75"
              stroke="${shine}" stroke-width="2"
              opacity=".7" fill="none"/>
    </svg>`;
}

// Add visual styles automatically.
const style = document.createElement("style");
style.textContent = `
    .square {
        position: relative;
        overflow: hidden;
    }

    .chess-piece {
        width: 88%;
        height: 88%;
        overflow: visible;
        pointer-events: none;
        filter: drop-shadow(0 3px 2px #0007);
        transition: transform .12s ease;
    }

    .square:hover .chess-piece {
        transform: scale(1.08);
    }

    .square.white-piece {
        color: #fff;
    }

    .square.black-piece {
        color: #222;
    }

    #adminPanel button {
        margin: 4px;
    }

    .cheat-heading {
        color: #e4c995;
        margin-top: 18px;
    }
`;
document.head.appendChild(style);

// --------------------------------------------------
// BOARD
// --------------------------------------------------

function drawBoard() {
    boardEl.innerHTML = "";
    const board = game.board();

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement("button");
            const name = "abcdefgh"[col] + (8 - row);
            const piece = board[row][col];

            square.className =
                "square " + ((row + col) % 2 ? "dark" : "light");

            if (selected === name) {
                square.classList.add("selected");
            }

            if (possibleMoves.includes(name)) {
                square.classList.add("possible");
            }

            if (piece) {
                square.classList.add(
                    piece.color === "w" ? "white-piece" : "black-piece"
                );
                square.innerHTML = pieceSVG(piece);
            }

            square.addEventListener("click", () => clickSquare(name));
            boardEl.appendChild(square);
        }
    }

    updateStatus();
}

function updateStatus() {
    try {
        if (game.in_checkmate()) {
            statusEl.textContent =
                "Checkmate! " +
                (game.turn() === "w" ? "Black" : "White") + " wins!";
        } else if (game.in_stalemate()) {
            statusEl.textContent = "Stalemate!";
        } else {
            statusEl.textContent =
                (game.turn() === "w" ? "White" : "Black") +
                "'s turn" +
                (game.in_check() ? " — CHECK!" : "");
        }
    } catch (error) {
        statusEl.textContent = "Chaos mode — unusual board position!";
        console.warn("Status check:", error);
    }
}

function safeFinished() {
    try {
        return game.in_checkmate() || game.in_stalemate();
    } catch {
        return false;
    }
}

// --------------------------------------------------
// CHEAT ACTIONS
// --------------------------------------------------

function clickSquare(square) {
    if (adminMode && adminAction) {
        handleCheatClick(square);
        return;
    }

    if (safeFinished()) return;

    if (roomChannel && playerColor !== game.turn()) {
        messageEl.textContent = "Wait for your turn.";
        return;
    }

    if (!selected) {
        const piece = game.get(square);

        if (!piece || piece.color !== game.turn()) return;

        selected = square;
        possibleMoves =
            game.moves({ square, verbose: true }).map(m => m.to);

        drawBoard();
        return;
    }

    const ownPiece = game.get(square);

    if (ownPiece && ownPiece.color === game.turn()) {
        selected = square;
        possibleMoves =
            game.moves({ square, verbose: true }).map(m => m.to);

        drawBoard();
        return;
    }

    let move = null;

    try {
        move = game.move({
            from: selected,
            to: square,
            promotion: "q"
        });
    } catch {
        move = null;
    }

    selected = null;
    possibleMoves = [];

    if (move) {
        messageEl.textContent = "";
        sendGameState();
    } else {
        messageEl.textContent = "Illegal move.";
    }

    drawBoard();
}

function handleCheatClick(square) {
    const piece = game.get(square);

    if (adminAction === "spawn") {
        const type = document.getElementById("pieceChoice").value;
        const color = prompt("Spawn color? Enter w or b:", "w");

        if (color === "w" || color === "b") {
            const result = game.put({ type, color }, square);
            messageEl.textContent =
                result ? "Piece spawned!" : "Couldn't spawn there.";
        }
    }

    if (adminAction === "delete") {
        messageEl.textContent =
            game.remove(square) ? "Piece deleted!" : "Square was empty.";
    }

    if (adminAction === "clone") {
        if (!cloneSource) {
            if (!piece) {
                messageEl.textContent = "Choose a square with a piece first.";
                return;
            }

            cloneSource = square;
            messageEl.textContent = "Now choose where to clone it.";
            return;
        }

        const original = game.get(cloneSource);

        if (original) {
            const result = game.put(
                { type: original.type, color: original.color },
                square
            );

            messageEl.textContent =
                result ? "Piece cloned!" : "Couldn't clone there.";
        }

        cloneSource = null;
    }

    adminAction = null;
    selected = null;
    possibleMoves = [];
    drawBoard();
    sendGameState();
}

function transformQueens(color) {
    const board = game.board();

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];

            if (piece && piece.color === color && piece.type !== "k") {
                const square = "abcdefgh"[col] + (8 - row);
                game.remove(square);
                game.put({ type: "q", color }, square);
            }
        }
    }

    messageEl.textContent =
        (color === "w" ? "White" : "Black") +
        " pieces transformed into queens!";
    finishCheat();
}

function removePawns() {
    const board = game.board();

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (board[row][col]?.type === "p") {
                game.remove("abcdefgh"[col] + (8 - row));
            }
        }
    }

    messageEl.textContent = "All pawns removed!";
    finishCheat();
}

function clearBoard() {
    const board = game.board();

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];

            if (piece && piece.type !== "k") {
                game.remove("abcdefgh"[col] + (8 - row));
            }
        }
    }

    messageEl.textContent = "Board cleared! Kings remain.";
    finishCheat();
}

function giveQueens(color) {
    let count = 0;

    for (let row = 0; row < 8 && count < 8; row++) {
        for (let col = 0; col < 8 && count < 8; col++) {
            const square = "abcdefgh"[col] + (8 - row);

            if (!game.get(square)) {
                if (game.put({ type: "q", color }, square)) {
                    count++;
                }
            }
        }
    }

    messageEl.textContent =
        "Added " + count + " queens for " +
        (color === "w" ? "White" : "Black") + "!";
    finishCheat();
}

function shufflePieces() {
    const squares = [];
    const pieces = [];
    const board = game.board();

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];

            if (piece && piece.type !== "k") {
                squares.push("abcdefgh"[col] + (8 - row));
                pieces.push({ type: piece.type, color: piece.color });
            }
        }
    }

    for (const square of squares) game.remove(square);

    for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }

    squares.forEach((square, i) => {
        game.put(pieces[i], square);
    });

    messageEl.textContent = "Pieces shuffled!";
    finishCheat();
}

function finishCheat() {
    selected = null;
    possibleMoves = [];
    cloneSource = null;
    adminAction = null;
    drawBoard();
    sendGameState();
}

// --------------------------------------------------
// SUPABASE MULTIPLAYER
// --------------------------------------------------

function connectSupabase() {
    if (sbClient) return true;

    const urlInput = document.getElementById("supabaseUrl");
    const key = document.getElementById("supabaseKey").value.trim();

    const match = urlInput.value.trim().match(
        /https?:\/\/[a-z0-9-]+\.supabase\.co/i
    );

    const url = match ? match[0] : "";

    if (!url || !key) {
        roomStatusEl.textContent =
            "Enter your Supabase URL and publishable key.";
        return false;
    }

    if (!window.supabase) {
        roomStatusEl.textContent = "Supabase library failed to load.";
        return false;
    }

    try {
        sbClient = window.supabase.createClient(url, key);
        return true;
    } catch (error) {
        roomStatusEl.textContent = error.message;
        return false;
    }
}

function makeRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function openRoom(code, color) {
    if (!connectSupabase()) return;

    if (roomChannel) {
        await sbClient.removeChannel(roomChannel);
        roomChannel = null;
    }

    roomCode = code;
    playerColor = color;

    roomChannel = sbClient.channel("normal-chess-" + code, {
        config: { broadcast: { self: false } }
    });

    roomChannel
        .on("broadcast", { event: "state" }, ({ payload }) => {
            if (!payload?.fen) return;

            try {
                game.load(payload.fen);
                selected = null;
                possibleMoves = [];
                drawBoard();
                messageEl.textContent = "Opponent's position updated.";
            } catch (error) {
                roomStatusEl.textContent = "Couldn't load opponent's position.";
            }
        })
        .on("broadcast", { event: "hello" }, () => {
            if (playerColor === "w") sendGameState();
        })
        .subscribe(status => {
            if (status === "SUBSCRIBED") {
                roomStatusEl.textContent =
                    "Connected to " + code + " as " +
                    (color === "w" ? "White" : "Black");

                if (color === "b") {
                    roomChannel.send({
                        type: "broadcast",
                        event: "hello",
                        payload: {}
                    });
                } else {
                    sendGameState();
                }
            } else if (
                status === "CHANNEL_ERROR" ||
                status === "TIMED_OUT"
            ) {
                roomStatusEl.textContent =
                    "Connection failed. Check Supabase Realtime.";
            }
        });
}

function sendGameState() {
    if (!roomChannel) return;

    roomChannel.send({
        type: "broadcast",
        event: "state",
        payload: { fen: game.fen() }
    });
}

// --------------------------------------------------
// BUTTONS
// --------------------------------------------------

document.getElementById("createRoomBtn").onclick = async () => {
    const code = makeRoomCode();
    document.getElementById("roomCode").value = code;
    await openRoom(code, "w");
};

document.getElementById("joinRoomBtn").onclick = async () => {
    const code = document.getElementById("roomCode")
        .value.trim().toUpperCase();

    if (!code) {
        roomStatusEl.textContent = "Enter a room code first.";
        return;
    }

    await openRoom(code, "b");
};

document.getElementById("spawnBtn").onclick = () => {
    adminAction = "spawn";
    messageEl.textContent = "Choose a square to spawn a piece.";
};

document.getElementById("deleteBtn").onclick = () => {
    adminAction = "delete";
    messageEl.textContent = "Choose a square to delete.";
};

document.getElementById("closeAdminBtn").onclick = closeAdmin;

function closeAdmin() {
    adminMode = false;
    adminAction = null;
    cloneSource = null;
    adminPanel.style.display = "none";
    messageEl.textContent = "";
}

document.addEventListener("keydown", event => {
    if (
        event.ctrlKey &&
        event.shiftKey &&
        event.key.toLowerCase() === "k"
    ) {
        event.preventDefault();

        if (adminMode) {
            closeAdmin();
            return;
        }

        const password = prompt("Admin password:");

        if (password === ADMIN_PASSWORD) {
            adminMode = true;
            addCheatButtons();
            adminPanel.style.display = "block";
            messageEl.textContent = "Admin controls unlocked.";
        } else if (password !== null) {
            messageEl.textContent = "Incorrect password.";
        }
    }
});

document.getElementById("resetBtn").onclick = () => {
    if (roomChannel && playerColor !== "w") {
        messageEl.textContent = "Only White can reset the room.";
        return;
    }

    game.reset();
    messageEl.textContent = "";
    finishCheat();
};

document.getElementById("undoBtn").onclick = () => {
    if (roomChannel && playerColor !== "w") {
        messageEl.textContent = "Only White can undo.";
        return;
    }

    try {
        game.undo();
    } catch (error) {
        messageEl.textContent = "Couldn't undo that move.";
    }

    finishCheat();
};

// --------------------------------------------------
// 200 CHEATS: 20 effects x 10 target groups
// --------------------------------------------------

const CHEAT_TARGETS = [
    { id: "all", label: "All pieces", test: () => true },
    { id: "white", label: "White pieces", test: p => p.color === "w" },
    { id: "black", label: "Black pieces", test: p => p.color === "b" },
    { id: "pawns", label: "Pawns", test: p => p.type === "p" },
    { id: "knights", label: "Knights", test: p => p.type === "n" },
    { id: "bishops", label: "Bishops", test: p => p.type === "b" },
    { id: "rooks", label: "Rooks", test: p => p.type === "r" },
    { id: "queens", label: "Queens", test: p => p.type === "q" },
    { id: "backrank", label: "Back-rank pieces", test: (p, s) => s[1] === "1" || s[1] === "8" },
    { id: "center", label: "Center pieces", test: (p, s) => ["c3","d3","e3","f3","c4","d4","e4","f4","c5","d5","e5","f5","c6","d6","e6","f6"].includes(s) }
];

const CHEAT_EFFECTS = [
    { id: "queen", name: "Turn into Queens", run: items => transformItems(items, "q") },
    { id: "rook", name: "Turn into Rooks", run: items => transformItems(items, "r") },
    { id: "bishop", name: "Turn into Bishops", run: items => transformItems(items, "b") },
    { id: "knight", name: "Turn into Knights", run: items => transformItems(items, "n") },
    { id: "pawn", name: "Turn into Pawns", run: items => transformItems(items, "p") },
    { id: "delete", name: "Delete Pieces", run: items => items.forEach(x => { if (x.piece.type !== "k") game.remove(x.square); }) },
    { id: "flipcolor", name: "Swap Piece Colors", run: items => transformItems(items, null, true) },
    { id: "clone", name: "Clone Pieces", run: items => cloneItems(items, 3) },
    { id: "randomtype", name: "Randomize Piece Types", run: items => randomizeItems(items) },
    { id: "forward", name: "Move Forward One Square", run: items => shiftItems(items, 0, 1) },
    { id: "backward", name: "Move Back One Square", run: items => shiftItems(items, 0, -1) },
    { id: "left", name: "Move Left One Square", run: items => shiftItems(items, -1, 0) },
    { id: "right", name: "Move Right One Square", run: items => shiftItems(items, 1, 0) },
    { id: "teleport", name: "Teleport to Random Squares", run: items => teleportItems(items) },
    { id: "mirror", name: "Mirror Positions Left/Right", run: items => relocateItems(items, s => "hgfedcba"["abcdefgh".indexOf(s[0])] + s[1]) },
    { id: "vertical", name: "Mirror Positions Up/Down", run: items => relocateItems(items, s => s[0] + (9 - Number(s[1]))) },
    { id: "rotate", name: "Rotate Positions 180°", run: items => relocateItems(items, s => "hgfedcba"["abcdefgh".indexOf(s[0])] + (9 - Number(s[1]))) },
    { id: "promote", name: "Promote Pawns to Queens", run: items => transformItems(items.filter(x => x.piece.type === "p"), "q") },
    { id: "demote", name: "Demote Queens to Pawns", run: items => transformItems(items.filter(x => x.piece.type === "q"), "p") },
    { id: "multiply", name: "Multiply Pieces", run: items => cloneItems(items, 6) }
];

function cheatSnapshot() {
    const out = [];
    const board = game.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece) out.push({
                square: "abcdefgh"[c] + (8 - r),
                piece: { type: piece.type, color: piece.color }
            });
        }
    }
    return out;
}

function transformItems(items, type, flipColor = false) {
    items.forEach(item => {
        const p = item.piece;
        if (p.type === "k") return;
        game.remove(item.square);
        game.put({
            type: type || p.type,
            color: flipColor ? (p.color === "w" ? "b" : "w") : p.color
        }, item.square);
    });
}

function cloneItems(items, copiesPerPiece) {
    const empty = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = "abcdefgh"[c] + (8 - r);
            if (!game.get(sq)) empty.push(sq);
        }
    }
    let made = 0;
    for (const item of items) {
        if (item.piece.type === "k") continue;
        for (let n = 0; n < copiesPerPiece && empty.length; n++) {
            const index = Math.floor(Math.random() * empty.length);
            const sq = empty.splice(index, 1)[0];
            if (game.put({ ...item.piece }, sq)) made++;
        }
        if (!empty.length) break;
    }
    messageEl.textContent = `Cloned ${made} piece${made === 1 ? "" : "s"}.`;
}

function randomizeItems(items) {
    const types = ["p", "n", "b", "r", "q"];
    items.forEach(item => {
        if (item.piece.type === "k") return;
        game.remove(item.square);
        game.put({
            type: types[Math.floor(Math.random() * types.length)],
            color: item.piece.color
        }, item.square);
    });
}

function shiftItems(items, dx, dy) {
    const moves = [];
    for (const item of items) {
        if (item.piece.type === "k") continue;
        const file = "abcdefgh".indexOf(item.square[0]) + dx;
        const rank = Number(item.square[1]) + dy;
        if (file < 0 || file > 7 || rank < 1 || rank > 8) continue;
        moves.push({ ...item, to: "abcdefgh"[file] + rank });
    }
    moves.forEach(x => game.remove(x.square));
    let moved = 0;
    moves.forEach(x => {
        if (!game.get(x.to) && game.put(x.piece, x.to)) moved++;
    });
    messageEl.textContent = `Shifted ${moved} piece${moved === 1 ? "" : "s"}.`;
}

function teleportItems(items) {
    const empty = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = "abcdefgh"[c] + (8 - r);
            if (!game.get(sq)) empty.push(sq);
        }
    }
    const moving = items.filter(x => x.piece.type !== "k");
    moving.forEach(x => game.remove(x.square));
    let moved = 0;
    for (const item of moving) {
        if (!empty.length) break;
        const i = Math.floor(Math.random() * empty.length);
        const to = empty.splice(i, 1)[0];
        if (game.put(item.piece, to)) moved++;
    }
    messageEl.textContent = `Teleported ${moved} pieces.`;
}

function relocateItems(items, destinationFn) {
    const moving = items.filter(x => x.piece.type !== "k");
    const origins = new Set(moving.map(x => x.square));
    const destinations = moving.map(x => ({
        ...x,
        to: destinationFn(x.square)
    }));
    moving.forEach(x => game.remove(x.square));
    let moved = 0;
    for (const item of destinations) {
        if ((!game.get(item.to) || origins.has(item.to)) &&
            game.put(item.piece, item.to)) moved++;
    }
    messageEl.textContent = `Rearranged ${moved} pieces.`;
}

function runCheat(effect, target) {
    const snapshot = cheatSnapshot();
    const items = snapshot.filter(x => target.test(x.piece, x.square));
    if (!items.length) {
        messageEl.textContent = "No matching pieces for that cheat.";
        return;
    }
    effect.run(items);
    finishCheat();
}

function addCheatButtons() {
    if (document.getElementById("extraCheats")) return;

    const panel = document.createElement("div");
    panel.id = "extraCheats";
    panel.innerHTML = `
        <h3 class="cheat-heading">Original Extra Controls</h3>
        <button id="cloneCheat">Clone Piece</button>
        <button id="whiteQueens">White Queen Army</button>
        <button id="blackQueens">Black Queen Army</button>
        <button id="queenifyWhite">Queenify White</button>
        <button id="queenifyBlack">Queenify Black</button>
        <button id="removePawns">Remove All Pawns</button>
        <button id="clearBoard">Clear Board</button>
        <button id="shuffleBoard">Shuffle Pieces</button>
        <h3 class="cheat-heading">200 Cheat Library</h3>
        <input id="cheatSearch" type="search" placeholder="Search 200 cheats..." style="width:95%;padding:9px;margin:6px 0">
        <p id="cheatCount" style="font-size:12px;opacity:.8"></p>
        <div id="cheatLibrary"></div>
    `;
    adminPanel.appendChild(panel);

    document.getElementById("cloneCheat").onclick = () => {
        adminAction = "clone";
        cloneSource = null;
        messageEl.textContent = "Choose a piece to clone.";
    };
    document.getElementById("whiteQueens").onclick = () => giveQueens("w");
    document.getElementById("blackQueens").onclick = () => giveQueens("b");
    document.getElementById("queenifyWhite").onclick = () => transformQueens("w");
    document.getElementById("queenifyBlack").onclick = () => transformQueens("b");
    document.getElementById("removePawns").onclick = removePawns;
    document.getElementById("clearBoard").onclick = clearBoard;
    document.getElementById("shuffleBoard").onclick = shufflePieces;

    const library = document.getElementById("cheatLibrary");
    const search = document.getElementById("cheatSearch");
    const count = document.getElementById("cheatCount");
    const catalog = [];

    CHEAT_TARGETS.forEach(target => {
        CHEAT_EFFECTS.forEach(effect => {
            catalog.push({
                title: `${target.label}: ${effect.name}`,
                target,
                effect
            });
        });
    });

    function renderCheatList(filter = "") {
        library.innerHTML = "";
        const matches = catalog.filter(item =>
            item.title.toLowerCase().includes(filter.toLowerCase())
        );
        count.textContent = `${matches.length} of ${catalog.length} cheats shown`;
        matches.forEach(item => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = item.title;
            button.style.cssText = "display:block;width:100%;text-align:left;margin:3px 0;padding:7px";
            button.onclick = () => runCheat(item.effect, item.target);
            library.appendChild(button);
        });
    }
    search.addEventListener("input", () => renderCheatList(search.value));
    renderCheatList();
}

// --------------------------------------------------
// MULTIPLAYER SYNC
// --------------------------------------------------

function sendGameState() {
    if (!roomChannel) return;

    roomChannel.send({
        type: "broadcast",
        event: "state",
        payload: { fen: game.fen() }
    }).catch(error => {
        roomStatusEl.textContent = "Sync error: " + error.message;
    });
}

// --------------------------------------------------
// START
// --------------------------------------------------

drawBoard();
