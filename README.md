# Normal Chess

A deliberately suspicious chess game with an admin cheat panel.

## Run locally
Open `index.html` in a modern browser. An internet connection is needed for the chess and Supabase libraries loaded from CDNs.

## Publish with GitHub Pages
1. Open your `normal-chess` repository.
2. Choose **Add file → Upload files**.
3. Upload `index.html`, `style.css`, `game.js`, and `README.md`.
4. Commit the files to the `main` branch.
5. Open **Settings → Pages**.
6. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then Save.

## Multiplayer setup (Supabase)
1. Create a project at https://supabase.com/.
2. In Project Settings → API, copy the Project URL and anon/public key.
3. Paste those values into the Online room panel in the game.
4. Create a room and share the displayed room code with your friend. Your friend enters the same Supabase URL/key and room code, then clicks Join room.

This is an early prototype. It uses Supabase Realtime Broadcast and a client-side host flag for the demo. **That is not secure authorization**: a determined guest could bypass the UI. Before using it with strangers, add authenticated users, server-verified room membership, and server-enforced host permissions (for example with Supabase Realtime Authorization or Edge Functions). Do not put a Supabase `service_role` key in browser code. The anon/public key is designed for client use, with appropriate project policies.

## Current cheats
- Spawn selected pieces
- Delete a piece
- Teleport a piece
- Turn a piece into a queen
- Clear non-king pieces
- Deploy a small queen army

Normal legal moves are validated by chess.js. This is a starter build, not a finished competitive chess platform.
