"""sync_site.py: the site's database gets the same 全服统计 and 推荐池 profiles as the collector's."""
import os
import sqlite3
import tempfile

import db
import player_profile
import recommend
import stats_source
import sync_site
from test_collector import fake_match


def collector_db():
    path = os.path.join(tempfile.mkdtemp(), "collector.sqlite")
    conn = sqlite3.connect(path)
    conn.executescript(db.SCHEMA)
    for k in range(25):
        m = fake_match(f"NA1_{k}")
        m["info"]["gameCreation"] = k
        if k % 3 == 0:   # vary results so wins differ per tier and pair
            for p in m["info"]["participants"]:
                p["win"] = not p["win"]
        db.save_match(conn, m, "GOLD" if k % 2 else "SILVER")
    conn.execute("UPDATE players SET tier='GOLD', division='II', league_points=10, sampled_at=1 WHERE puuid='p0'")
    conn.commit()
    conn.close()
    return path


def test_sync_matches_own_data():
    src = collector_db()
    dst = os.path.join(tempfile.mkdtemp(), "site.sqlite")
    counts = sync_site.sync(src, dst, log=lambda *_: None)
    assert counts["pool players"] == 1 and counts["new matches"] == 25 and counts["new participants"] == 25

    own = stats_source.OwnDataSource(sqlite3.connect(src))
    site = db.connect(dst)
    agg = stats_source.default_source(site).inner
    assert isinstance(agg, stats_source.AggregateSource)
    for tier in ("GOLD", "SILVER", "PLATINUM"):
        assert agg.champion("Champ0", "TOP", tier) == own.champion("Champ0", "TOP", tier)
    for a, b in [(("Champ0", "TOP"), ("Champ1", "JUNGLE")), (("Champ6", "JUNGLE"), ("Champ5", "TOP")),
                 (("Champ0", "TOP"), ("Champ5", "TOP"))]:
        assert agg.champion_pair(*a, *b) == own.champion_pair(*a, *b)
        assert agg.champion_pair(*b, *a) == own.champion_pair(*b, *a)

    pool = recommend.candidate_pool(site)
    assert [(p[0], p[2][0], len(p[3])) for p in pool] == [("p0", "GOLD", 25)]
    assert player_profile.proficiency(site, "p0", pool[0][3]) == \
        player_profile.proficiency(sqlite3.connect(src), "p0", pool[0][3])

    # The site's opt-in survives a rerun, and nothing already there is sent again.
    site.execute("UPDATE players SET recommend_opt_in=1 WHERE puuid='p0'")
    site.commit()
    again = sync_site.sync(src, dst, log=lambda *_: None)
    assert again["new matches"] == 0 and again["new participants"] == 0
    assert site.execute("SELECT recommend_opt_in FROM players WHERE puuid='p0'").fetchone() == (1,)


def test_without_sums_the_site_counts_its_own_matches():
    conn = db.connect(os.path.join(tempfile.mkdtemp(), "plain.sqlite"))
    db.save_match(conn, fake_match("NA1_1"), "GOLD")
    assert isinstance(stats_source.default_source(conn).inner, stats_source.OwnDataSource)
