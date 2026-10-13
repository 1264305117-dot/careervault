"""一次性迁移：给简历里的每条要点补上句末的「。」。

背景：模型生成要点时习惯省略句末标点，读起来像被截断的半句话。
生成链路（前端 src/lib/ai.ts::fillBulletStops / 后端 api/ai.py）已经修好，
这个脚本负责把**存量简历**按同一套规则补齐（api/text_rules.py::with_full_stop）。

只动简历的 bullets：经历库里的 STAR 是用户原始素材，一字不改。
幂等：已是终止标点结尾的要点不会被二次加工。

用法：
    python migrate_bullets_period.py [库路径]      # 省略则用 data/careervault.db
"""
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from api.text_rules import with_full_stop  # noqa: E402

DB = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent / "data" / "careervault.db"


def main() -> None:
    if not DB.exists():
        raise SystemExit(f"找不到数据库：{DB}")
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    changed_resumes = 0
    changed_bullets = 0
    for row in conn.execute("SELECT id, title, content FROM resumes ORDER BY id"):
        try:
            content = json.loads(row["content"])
        except (TypeError, ValueError):
            print(f"  ! resume{row['id']} content 不是合法 JSON，跳过")
            continue

        touched = 0
        for sec in content.get("sections") or []:
            for it in sec.get("items") or []:
                bullets = it.get("bullets") or []
                new_bullets = []
                for b in bullets:
                    nb = with_full_stop(b)
                    if nb != b:
                        touched += 1
                    new_bullets.append(nb)
                it["bullets"] = new_bullets

        if touched:
            conn.execute(
                "UPDATE resumes SET content = ? WHERE id = ?",
                (json.dumps(content, ensure_ascii=False), row["id"]),
            )
            changed_resumes += 1
            changed_bullets += touched
            print(f"  resume{row['id']} 《{row['title']}》：补了 {touched} 条要点")
        else:
            print(f"  resume{row['id']} 《{row['title']}》：无需改动")

    conn.commit()
    conn.close()
    print(f"\n完成：{changed_resumes} 份简历、{changed_bullets} 条要点补上句号。")
    print(f"数据库：{DB}")


if __name__ == "__main__":
    main()
