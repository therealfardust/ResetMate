# Reset Mate Lab

A local-first web tool and Stockfish-aware Python bot for the Aman Hambleton-style **Reset Mate**.

The canonical white pattern documented in the source article is:

`Qe2 Qg2 Rh3 Rf3 Qg4 Rf5 Qg6 Rf6 Qg7 Qf8 Rd6 Rd8 Qe7 Rd6 Qc7 Rd2 Rh2 Rh1 Qd6 Qd1#`

The black mirror ends in `Qd8#`. The article says the white sequence works as long as the opponent king is not on g3, and the black sequence has the analogous g6 restriction.

## Project structure

- `web/` — GitHub Pages-ready static site. No backend is required for the exact solver/trainer.
- `python/` — local Stockfish-aware bot and exact sequence checker.
- `docs/` — design notes.

## Website

Open `web/index.html` through a local static server, or publish the `web/` directory with GitHub Pages.

### Local server

From the `web` directory:

```powershell
python -m http.server 8123
```

Then open `http://localhost:8123`.

The site loads `chess.js` and the browser Stockfish 19 lite single-threaded build from public CDNs. The exact reset checker itself does not require Stockfish. It searches legal replies from the opposing king and looks for a line that completes the published White pattern; it is an existence solver, not a claim that every possible defensive reply works.

For a fully offline deployment, download the pinned chess.js/Stockfish assets and place them in `web/vendor/`, then change the imports in `index.html` and the Stockfish worker URL in `app.js`.

## Python bot

```powershell
cd python
python -m pip install -r requirements.txt
python reset_mate_bot.py --help
```

The Python bot expects a local Stockfish executable. Stockfish communicates through UCI; python-chess provides the engine interface and board rules.

## Important engine behavior

The bot does **not** blindly sacrifice a winning position just to make the meme happen. Its design is:

1. Keep normal Stockfish play as the primary objective.
2. Track the material needed for the restored back rank.
3. Treat promotion pawns as reconstruction resources.
4. Penalize lines that make reconstruction impossible when an alternative exists.
5. Once the exact reset endgame is available, switch to the fixed-sequence endgame planner.

This is a heuristic steering system during a normal game, not a proof that the special mate is reachable from every chess position. The dedicated reset solver is exact for the fixed pattern once a valid reduced position is supplied.

## Licensing

Stockfish is GPLv3. If you redistribute Stockfish itself or modified Stockfish code/binaries, follow its GPLv3 requirements and include the corresponding source/license information. The web project intentionally loads the engine rather than bundling a large engine binary.
