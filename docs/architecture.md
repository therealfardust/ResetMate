# Architecture

## A. Exact Reset Pattern

The reset pattern is represented as a fixed White and Black move list. The exact checker uses legal move generation and recursively explores the opponent's legal replies between the prescribed moves.

That distinction matters: the published pattern lists the user's moves, not the opponent's replies. A correct solver therefore cannot simply push all 20 moves consecutively.

## B. Resource model

The required restored White rank is:

`R N B Q K B N R`

A missing non-pawn piece is not automatically impossible because a pawn can promote into R/N/B/Q. The planner therefore reports:

- pieces currently present;
- pieces missing;
- number of pawns available as potential replacement resources;
- a necessary (not sufficient) reconstruction test.

Pawn geometry, promotion squares, enemy interference, and king legality can still make a reconstruction impossible.

## C. Stockfish steering

For each engine candidate, the bot combines ordinary engine evaluation with a secondary reset-mate heuristic. The secondary objective is deliberately weaker than a forced chess win: normal chess remains primary.

The desired transition is:

`normal game -> preserve resources -> secure reset setup -> exact reset solver -> Qd1#`

## D. Future exact endgame layer

For positions with seven or fewer pieces, Syzygy WDL/DTZ tablebases can be used through python-chess. The final reset puzzle itself normally contains more than seven pieces, so tablebases cannot solve the whole reset sequence directly. They are still useful for proving small conversion phases before the full rank is restored.
