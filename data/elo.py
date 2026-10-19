"""Win rate <-> Elo-difference conversion and shrinkage, as in DraftGap (ADR-0001).

Adapted from DraftGap (https://github.com/vigovlugt/draftgap),
MIT License, Copyright (c) Vigo Vlugt.
"""
import math

ELO_SCALE = 400  # standard Elo: a 400-point gap means 10:1 odds


def winrate_to_elo(p):
    """50% -> 0. Clamped so 0% / 100% stay finite."""
    p = min(max(p, 1e-4), 1 - 1e-4)
    return -ELO_SCALE * math.log10(1 / p - 1)


def elo_to_winrate(d):
    return 1 / (1 + 10 ** (-d / ELO_SCALE))


def shrink(wins, games, prior_winrate, prior_games):
    """Pull a small sample toward prior_winrate as if prior_games extra games had been played at it."""
    return (wins + prior_winrate * prior_games) / (games + prior_games)
