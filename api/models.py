"""生职迹 Career Trail · 共享数据模型"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ExpType = Literal["实习", "项目", "校园", "科研", "教育", "技能"]
ResumeTemplate = Literal["classic", "band", "timeline", "bold", "formal"]


# ---------------- 经历库 ----------------
class VaultIn(BaseModel):
    """一个经历库 = 一个人的完整工作区（经历 + 简历）。

    「帮朋友建库」是明确的产品需求，所以库不是隐含的单例，而是可增删的实体：
    切换库等于切换「现在在看谁的数据」。
    """

    name: str = Field(min_length=1, max_length=40)
    owner: str = Field(default="", max_length=40)


class ExpTaskIn(BaseModel):
    """一段经历下的一个独立任务。每个任务各带自己的 S/T/A/R。

    背景：简历里一段实习常有 3-5 条要点，它们是**彼此独立的任务**，
    各有自己的情境与结果；早期版本把它们全部合并进经历的 star_a，导致
    "整段实习变成 STAR 里的 A"。
    """

    name: str = ""       # 任务小标题，如「增长模块需求迭代」
    star_s: str = ""
    star_t: str = ""
    star_a: str = ""
    star_r: str = ""


class ExperienceIn(BaseModel):
    type: ExpType
    title: str = Field(min_length=1, max_length=100)
    org: str = ""
    date_range: str = ""
    tags: list[str] = []
    # 经历级「主线 STAR」：整段经历的背景 / 整体职责 / 总体行动 / 整体成果
    star_s: str = ""
    star_t: str = ""
    star_a: str = ""
    star_r: str = ""
    # 任务清单：这段经历具体由哪几件事组成
    tasks: list[ExpTaskIn] = []
    # 归属的经历库；为空则落到默认库（前端总会显式带上当前库）
    vault_id: int | None = None


# ---------------- 简历 ----------------
class ResumeItem(BaseModel):
    heading: str = ""          # 条目标题，如「某大厂 · 产品经理实习生」
    subheading: str = ""       # 副标题，如起止时间
    bullets: list[str] = []    # 要点列表


class ResumeSection(BaseModel):
    name: str                  # 板块名，如「实习经历」
    items: list[ResumeItem] = []


class ResumeContent(BaseModel):
    title: str = "未命名简历"
    summary: str = ""          # 一句话职业概述
    sections: list[ResumeSection] = []
    # 页头第一行写姓名、第二行写联系方式（邮箱 · 手机号）；
    # title 只是这份简历在列表里的文件名，不再印在简历上。
    # 老简历没有这两个字段时导出回落到 title。
    name: str = ""             # 姓名（页头第一行）
    contact: str = ""          # 联系方式（页头第二行，如「xx@qq.com · 138xxxxxxxx」）
    # 版式模板：经典居中 / 现代色带 / 时间轴 / 醒目大字
    template: ResumeTemplate = "classic"
    # 证件照：data URL（前端已压缩到 ~320px），空字符串表示不放照片
    photo: str = ""


class ResumeIn(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    jd: str = ""
    content: ResumeContent
    vault_id: int | None = None
