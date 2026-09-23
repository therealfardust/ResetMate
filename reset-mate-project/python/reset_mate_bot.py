from __future__ import annotations

import argparse
from dataclasses import dataclass
from typing import Optional

import chess
import chess.engine

WHITE_PATTERN = [
    'Qe2','Qg2','Rh3','Rf3','Qg4','Rf5','Qg6','Rf6','Qg7','Qf8',
    'Rd6','Rd8','Qe7','Rd6','Qc7','Rd2','Rh2','Rh1','Qd6','Qd1#'
]
BLACK_PATTERN = [
    'Qe7','Qg7','Rh6','Rf6','Qg5','Rf4','Qg3','Rf3','Qg2','Qf1',
    'Rd3','Rd1','Qe2','Rd3','Qc2','Rd7','Rh7','Rh8','Qd3','Qd8#'
]

REQUIRED = {chess.ROOK:2, chess.KNIGHT:2, chess.BISHOP:2,
            chess.QUEEN:1, chess.KING:1}


def inventory(board: chess.Board, color: chess.Color):
    out = {t: 0 for t in [chess.PAWN, chess.KNIGHT, chess.BISHOP,
                          chess.ROOK, chess.QUEEN, chess.KING]}
    for p in board.piece_map().values():
        if p.color == color:
            out[p.piece_type] += 1
    return out


def resource_state(board: chess.Board, color=chess.WHITE):
    inv = inventory(board, color)
    missing = {t:max(0, need-inv[t]) for t,need in REQUIRED.items()}
    total = sum(missing.values())
    return inv, missing, total, inv[chess.PAWN]


def lone_king(board: chess.Board, color=chess.BLACK):
    inv = inventory(board, color)
    return inv[chess.KING] == 1 and sum(inv[t] for t in inv if t != chess.KING) == 0


def exact_back_rank(board: chess.Board, color=chess.WHITE):
    rank = 1 if color == chess.WHITE else 8
    expected = [chess.ROOK, chess.KNIGHT, chess.BISHOP, chess.QUEEN,
                chess.KING, chess.BISHOP, chess.KNIGHT, chess.ROOK]
    actual = []
    for file in range(8):
        p = board.piece_at(chess.square(file, rank-1))
        actual.append(p.piece_type if p and p.color == color else None)
    return actual == expected


def find_reset_line(board: chess.Board, color=chess.WHITE):
    """Find one legal line following the published white/black pattern.

    The published reset list contains the moves of the player performing the
    reset, while the opponent's replies are omitted. We therefore search over
    legal opponent replies and return one complete line that reaches mate.
    This is an existence solver, not a claim that every opponent reply works.
    """
    seq = WHITE_PATTERN if color == chess.WHITE else BLACK_PATTERN
    memo = {}

    def dfs(b: chess.Board, i: int):
        key = (b.fen(), i)
        if key in memo:
            return memo[key]
        if i == len(seq):
            result = [] if b.is_checkmate() and b.turn != color else None
            memo[key] = result
            return result

        if b.turn != color:
            for mv in b.legal_moves:
                c = b.copy(stack=False)
                san = b.san(mv)
                uci = mv.uci()
                c.push(mv)
                tail = dfs(c, i)
                if tail is not None:
                    result = [(b.turn, san, uci)] + tail
                    memo[key] = result
                    return result
            memo[key] = None
            return None

        wanted = seq[i].replace('#', '')
        for mv in b.legal_moves:
            san = b.san(mv)
            if san == wanted or san.rstrip('+#') == wanted:
                c = b.copy(stack=False)
                uci = mv.uci()
                c.push(mv)
                tail = dfs(c, i + 1)
                if tail is not None:
                    result = [(b.turn, san, uci)] + tail
                    memo[key] = result
                    return result
                break

        memo[key] = None
        return None

    return dfs(board.copy(stack=False), 0)


def fixed_sequence_succeeds(board: chess.Board, color=chess.WHITE):
    return find_reset_line(board, color) is not None


def reset_score(board: chess.Board, color=chess.WHITE):
    inv, missing, total, pawns = resource_state(board, color)
    score = -500 * total + 250 * min(total, pawns)
    targets = {
        chess.A1: chess.ROOK, chess.B1: chess.KNIGHT,
        chess.C1: chess.BISHOP, chess.D1: chess.QUEEN,
        chess.E1: chess.KING, chess.F1: chess.BISHOP,
        chess.G1: chess.KNIGHT, chess.H1: chess.ROOK,
    }
    for sq, typ in targets.items():
        p = board.piece_at(sq)
        if p and p.color == color and p.piece_type == typ:
            score += 150
    king = board.king(not color)
    if king == chess.C2:
        score += 100
    return score


@dataclass
class Candidate:
    move: chess.Move
    score: float
    engine_cp: int


class ResetAwareBot:
    def __init__(self, stockfish: str, depth: int = 16, multipv: int = 8):
        self.engine = chess.engine.SimpleEngine.popen_uci(stockfish)
        self.depth = depth
        self.multipv = multipv

    def close(self):
        self.engine.quit()

    def choose(self, board: chess.Board):
        infos = self.engine.analyse(
            board,
            chess.engine.Limit(depth=self.depth),
            multipv=self.multipv,
        )
        candidates = []
        for info in infos:
            if not info.get('pv'):
                continue
            move = info['pv'][0]
            cp = info['score'].pov(board.turn).score(mate_score=100000) or 0
            nxt = board.copy(stack=False)
            nxt.push(move)
            # Engine score is primary; reset objective is a secondary tie-break.
            reset = reset_score(nxt, chess.WHITE)
            score = cp + 0.35 * reset
            candidates.append(Candidate(move, score, cp))

        if not candidates:
            return self.engine.play(board, chess.engine.Limit(depth=self.depth)).move
        return max(candidates, key=lambda x:x.score).move


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stockfish')
    ap.add_argument('--fen', default=chess.STARTING_FEN)
    ap.add_argument('--depth', type=int, default=16)
    ap.add_argument('--multipv', type=int, default=8)
    ap.add_argument('--check-reset', action='store_true')
    args = ap.parse_args()

    board = chess.Board(args.fen)
    if args.check_reset:
        inv, missing, total, pawns = resource_state(board)
        print('White inventory:', inv)
        print('Missing:', missing)
        print('Promotion resources:', pawns)
        print('Exact back rank:', exact_back_rank(board))
        print('Black lone king:', lone_king(board))
        line = find_reset_line(board)
        print('Reset sequence succeeds:', line is not None)
        if line:
            print('\nOne legal line:')
            for i, (side, san, uci) in enumerate(line, 1):
                label = 'White' if side == chess.WHITE else 'Black'
                print(f'{i:2}. {label:5s} {san:8s} {uci}')
        return

    if not args.stockfish:
        ap.error('--stockfish is required unless --check-reset is used')
    bot = ResetAwareBot(args.stockfish, args.depth, args.multipv)
    try:
        while not board.is_game_over():
            move = bot.choose(board)
            print(board.fullmove_number, '...' if board.turn == chess.BLACK else '.', board.san(move), move.uci())
            board.push(move)
    finally:
        bot.close()

    print('Result:', board.result())


if __name__ == '__main__':
    main()
