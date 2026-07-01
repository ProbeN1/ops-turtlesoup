# Scenario Intake

本文档定义“别人提供故障信息后，如何提取内容并纳入题目仓库”的流程。后续收到一段事故复盘、值班记录、告警截图描述、聊天记录摘要或口述故障时，按本文完成题目生成。

## 目标

- 从原始故障信息中提取一份可玩的运维海龟汤题目。
- 每道题单独保存为一个 JSON 文件。
- 汤面对玩家隐藏根因，只暴露刚接手故障时可见的有限表象。
- 谜底、关键点、误导项、问答规则和知识点必须足够明确，方便主持人稳定判断。

## 存储位置

每道题一个文件，目录按难度拆分：

```text
data/scenarios/easy/easy-001.json
data/scenarios/medium/medium-001.json
data/scenarios/hard/hard-001.json
```

文件名必须等于题目 `id` 加 `.json`。例如：

```text
data/scenarios/easy/easy-003.json
```

对应字段：

```json
{
  "id": "easy-003",
  "difficulty": "easy"
}
```

## 输入材料

尽量从提供者那里收集：

- 故障发生时间、恢复时间、持续时长。
- 第一眼看到的告警、指标、截图或用户反馈。
- 受影响系统、基础设施背景、依赖链路。
- 已知处置动作和它们是否有效。
- 最终根因、临时止血、长期修复。
- 容易误导排查方向的现象。
- 可以公开给玩家的知识点和参考资料。

如果信息不足，先生成草稿并在 `references` 或文档备注中标明缺口，不要编造关键事实。

## 提取步骤

1. 判断难度。
   - `easy`：一个主要故障机制，常见运维域，玩家发现根因加一个定位点即可成功。
   - `medium`：两个因素互相作用，至少一个误导表象，需要说明两个关键关联点。
   - `hard`：多层因果链，包含触发、放大、依赖或恢复滞后。

2. 提取基础设施背景。
   - 写入 `infra_background`。
   - 只写理解故障所需背景，不直接泄露根因。
   - 推荐字段：`platform`、`architecture`、`storage`、`database`、`scheduler`、`observability`、`traffic`、`dependency`。

3. 编写汤面。
   - 写入 `story`。
   - 控制在 1-2 句。
   - 必须包含可观测精确细节：时间点、指标名、变化前后数值、持续时间。
   - 模拟值班人员刚接手时的一脸懵，只写第一眼看见的信息。
   - 不要把根因、完整时间线、处置细节提前塞进汤面。

4. 写出谜底。
   - `answer`：完整真相，用一段话讲清楚根因和为什么现象会这样。
   - `root_cause`：一句话根因。
   - `temporary_fix`：临时止血。
   - `permanent_fix`：长期修复。

5. 定义成功标准。
   - `must_discover` 写玩家必须拼出的关键事实。
   - easy 至少 2-4 条，medium 3-5 条，hard 4-6 条。
   - 不要把“猜到组件名”当成功，必须覆盖因果或定位点。

6. 提取误导项和禁泄项。
   - `misleading`：玩家容易误判的表象。
   - `forbidden`：主持人在未成功前不能主动透露的答案级信息。

7. 编写问答规则。
   - `question_rules.yes`：问到这些事实时应答“是”。
   - `question_rules.no`：问到这些反事实时应答“否”。
   - `question_rules.irrelevant`：与根因无关或会带偏的方向。
   - 规则应覆盖常见玩家问法，而不是只写内部术语。

8. 补充推理路径和知识点。
   - `thinking_path`：推荐排查顺序。
   - `knowledge_points`：这题希望玩家学到的运维知识。
   - `references`：可公开链接或内部文档编号；没有就留空数组。

## 标准模板

```json
{
  "id": "easy-003",
  "title": "",
  "difficulty": "easy",
  "category": "",
  "tags": [],
  "infra_background": {},
  "story": "",
  "answer": "",
  "must_discover": [],
  "misleading": [],
  "forbidden": [],
  "question_rules": {
    "yes": [],
    "no": [],
    "irrelevant": []
  },
  "thinking_path": [],
  "root_cause": "",
  "temporary_fix": "",
  "permanent_fix": "",
  "knowledge_points": [],
  "references": []
}
```

## 纳入流程

1. 根据难度选择目录。
2. 查看已有最大编号，生成下一个 `id`。
3. 新建 `data/scenarios/<difficulty>/<id>.json`。
4. 用标准模板填充内容。
5. 运行：

```powershell
npm test
```

6. 如果题库或编写规则变化，更新：

```text
docs/scenario-authoring.md
docs/scenario-intake.md
docs/changelog.md
```

7. 记录工作日志并提交 Git。

## 质量检查

入库前逐项确认：

- 文件名与 `id` 一致。
- `difficulty` 与目录一致。
- `story` 不提前泄露根因。
- `infra_background` 是对象。
- `must_discover` 非空，且能支撑成功判定。
- `question_rules` 三个数组都存在。
- `forbidden` 覆盖最容易被主持人提前说漏的事实。
- `temporary_fix` 和 `permanent_fix` 区分清楚。
- 没有密钥、真实个人信息或不可公开业务敏感内容。
