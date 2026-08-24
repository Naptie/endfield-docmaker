import type { TemplateDefinition } from './types';
import type { IssuerKey } from '$lib/types';
import { ISSUERS, getLogoScales, issuerExt } from '$lib/constants';
import { m } from '$lib/paraglide/messages';
import type { KvEntry } from '$lib/components/KvGrid.svelte';
import img6 from '$lib/assets/misc/6.png?url';
import img17 from '$lib/assets/misc/17.png?url';

export interface TestpaperValues {
  issuer: IssuerKey;
  year: string;
  title: string;
  subject: string;
  paperSize: string;
  examType: string;
  examDuration: string;
  examInfo: KvEntry[];
  showAnswer: boolean;
  parJustify: boolean;
  secret: string;
  showScoreBox: boolean;
  docContent: string;
}

const escapeTypst = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const parseYear = (raw: string): number => {
  const n = parseInt(raw, 10);
  return isNaN(n) || n <= 0 ? 152 : n;
};

export const testpaperTemplate: TemplateDefinition = {
  id: 'testpaper',
  name: () => m.template_testpaper(),
  gridCols: 3,
  storageVersion: 3,
  fields: [
    {
      type: 'select',
      key: 'issuer',
      label: () => m.issuer(),
      placeholder: () => m.select_issuer(),
      options: ISSUERS.map((i) => ({
        value: i.key,
        label: () => m[`issuer_${i.key}`]()
      })),
      colspan: 1
    },
    {
      type: 'select',
      key: 'paperSize',
      label: () => m.testpaper_paper_size(),
      options: [
        { value: 'a3', label: () => 'A3' },
        { value: 'a4', label: () => 'A4' }
      ],
      colspan: 1
    },
    {
      type: 'number',
      key: 'year',
      label: () => m.testpaper_year(),
      min: 1,
      placeholder: '152',
      colspan: 1
    },
    {
      type: 'text',
      key: 'secret',
      label: () => m.testpaper_secret(),
      placeholder: () => m.testpaper_secret_placeholder(),
      colspan: 1
    },
    {
      type: 'text',
      key: 'examType',
      label: () => m.testpaper_exam_type(),
      placeholder: () => 'A',
      colspan: 1
    },
    {
      type: 'text',
      key: 'examDuration',
      label: () => m.testpaper_exam_duration(),
      placeholder: () => '120分钟',
      colspan: 1
    },
    {
      type: 'text',
      key: 'title',
      label: () => m.testpaper_title(),
      placeholder: () => m.testpaper_title_placeholder(),
      colspan: 2
    },
    {
      type: 'text',
      key: 'subject',
      label: () => m.testpaper_subject(),
      placeholder: () => m.testpaper_subject_placeholder(),
      colspan: 1
    },
    {
      type: 'kv-grid',
      key: 'examInfo',
      label: () => m.testpaper_exam_info()
    },
    {
      type: 'toggle',
      key: 'showAnswer',
      label: () => m.testpaper_show_answer(),
      colspan: 1
    },
    {
      type: 'toggle',
      key: 'parJustify',
      label: () => m.testpaper_par_justify(),
      colspan: 1
    },
    {
      type: 'toggle',
      key: 'showScoreBox',
      label: () => m.testpaper_show_score_box(),
      colspan: 1
    },
    {
      type: 'file-list',
      key: 'files',
      label: () => m.file_list(),
      defaultFiles: [
        { name: '6.png', url: img6 },
        { name: '17.png', url: img17 }
      ]
    },
    {
      type: 'textarea',
      key: 'docContent',
      label: () => m.testpaper_content(),
      placeholder: () => m.testpaper_content_placeholder(),
      grow: true,
      minHeight: 40
    }
  ],
  defaults: () => ({
    issuer: ISSUERS[0].key as string,
    year: '152',
    title: '全文明环带普通高等学校招生统一考试',
    subject: '数学',
    paperSize: 'a3',
    examType: 'A',
    examDuration: '120分钟',
    examInfo: [{ key: '命题组', value: '终末地工业' }] satisfies KvEntry[],
    showAnswer: false,
    parJustify: true,
    secret: '绝密',
    showScoreBox: true,
    docContent: `\
#notice(
  [答题前，请务必将自已的姓名、准考证号用0.5毫米黑色墨水的签字笔填写在试卷及答题卡的规定位置。],
  [请认真核对监考员在答题卡上所粘贴的条形码上的姓名、准考证号与本人是否相符。],
  [作答选择题必须用2B铅笔将答题卡上对应选项的方框涂满、涂黑；如需改动，请用橡皮擦干净后，再选涂其他答案。作答非选择题，必须用0.5毫米黑色墨水的签字笔在答题卡上的指定位置作答，在其他位置作答一律无效。],
  [本试卷共4页，满分#total-pts 分，考试时间为120分钟。考试结束后，请将本试卷和答题卡一并交回。],
)

#set-default-pts(5)
= 单选题：本题共 #q-count 小题，每小题 #single-pts 分，共 #section-pts 分。在每小题给出的四个选项中，只有一项是符合题目要求的。
#question[
  $(1 + 5"i")"i"$ 的虚部为 #paren[C]
  #choices(-1, 0, 1, 6)
]

#question[
  集合 $U = {x | x$为小于9的正整数}, $A = {1,3,5}$, 则 $complement_U A$ 中的元素个数为 #paren[C]
  #choices(0, 3, 5, 8)
]

#question[
  若双曲线 $C$ 的虚轴长为实轴长的 $sqrt(7)$ 倍，则 $C$ 的离心率为 #paren[D]
  #choices([$sqrt(2)$], 2, [$sqrt(7)$], [$2sqrt(2)$])
]

#question[
  若点 $(a,0) (a > 0)$ 是函数 $y = 2tan(x - pi / 3)$ 的图象的一个对称中心，则 $a$ 的最小值为 #paren[B]
  #choices([30°], [60°], [90°], [135°])
]

#question[
  设 $f(x)$ 是定义在 $R$ 上且周期为 2 的偶函数，当 $2 lt.slant x lt.slant 3$ 时，$f(x) = 5 - 2x$，则 $f(-3 / 4 ) =$
  #paren[A]
  #choices([$-1 / 2$], [$-1 / 4$], [$1 / 4$], [$1 / 2$])
]

#question[
  已知视风速是真风速和船风速的和向量，船风速与船行驶速度大小相等，方向相反.则真风速等级是 #paren[A]
  #text-figure(
    figure: image("6.png", height: 1.5in),
    figure-x: -1in,
  )[#choices(
    columns: 1,
    [轻风 (1.6$~$3.3 m/s)],
    [微风 (3.4$~$5.4 m/s)],
    [和风 (5.5$~$7.8 m/s)],
    [劲风 (8.0$~$10.7 m/s)],
  )]
]

#question[
  若圆 $x^2 + (y + 2)^2 = r^2 (r > 0)$ 上到直线 $y = sqrt(3)x + 2$ 的距离为 1 的点有且仅有 2 个，则 $r$ 的取值范围是
  #paren[B]
  #choices([(0, 1)], [(1, 3)], [(3, +∞)], [(0, +∞)])
]

#question[
  若实数 $x, y, z$ 满足 $2 + log_2 x = 3 + log_3y = 5 + log_5 z$，则 $x, y, z$ 的大小关系不可能是 #paren[B]
  #choices([$x > y > z$], [$x > z > y$], [$y > x > z$], [$y > z > x$])
]

#set-default-pts(6)
= 多选题：本题共 #q-count 小题，每小题 #single-pts 分，共 #section-pts 分。在每小题给出的选项中，有多项符合题目要求。全部选对的得 #single-pts 分，部分选对的得部分分，有选错的得 0 分。
#question[
  在正三棱柱 $A B C-A_1B_1C_1$ 中，$D$ 为 $B C$ 中点，则 #paren[BD]
  #choices([$A D perp A_1C$], [$B_1C perp "平面" A A_1D$], [$C C_1 parallel "平面" A A_1D$], [$A D parallel A_1B_1$])
]

#question[
  设抛物线 $C: y^2 = 6x$ 的焦点为 $F$，过 $F$的直线交 $C$ 于$A、B$，过 $F$ 且垂直于 $A B$的直线交准线 $l$: $y = -3 / 2x$
  于 $E$，过点$A$作准线的垂线，垂足为$D$，则 #paren[ACD]
  #choices([$|A D| = |A F|$], [$|A E| = |A B|$], [$|A B| gt.slant 6$], [$|A E| dot |B E| gt.slant 18$])
]

#question[
  已知 $triangle A B C$ 的面积为 $1 / 4$，若 $cos 2A + cos 2B + cos 2C = 2,cos A cos B sin C = 1 / 4$，则 #paren[ACD]
  #choices([$sin C = sin^2 A + sin^2 B$], [$A B = sqrt(2)$], [$sin A + sin B = sqrt(6) / 2$], [$A C^2 + B C^2 = 3$])
]

#set-default-pts(5)
= 填空题：本题共 #q-count 小题，每小题 #single-pts 分，共 #section-pts 分。
#question[
  若直线 $y = 2x +5$ 是曲线 $y = e^x + x + a$ 的切线，则 $a =$#fillin[4].
]

#question[
  若一个正项等比数列的前 4 项和为 4，前 8 项和为 68，则该等比数列的公比为 #fillin[$plus.minus 2$].
]

#question[
  一个箱子里有 5 个球，分别以 1$~$5 标号，若有放回取三次，记至少取出一次的球的个数 $X$，则 $E(X) =$#fillin[$61/25$].
]

#set-default-pts(none)
= 解答题：本题共 #q-count 小题，共 #section-pts 分。解答应写出文字说明、证明过程或演算步骤。
#question(points: 13, bottom: 1in)[
  为研究某疾病与超声波检查结果的关系，从做过超声波检查的人群中随机调查了1000人，得到如下的列联表：
  #align(center)[
    #table(
      columns: 4,
      [], [正常], [不正常], [合计],
      [患该疾病], [20], [180], [200],
      [未患该疾病], [780], [20], [800],
      [合计], [800], [200], [1000],
    )
  ]
  + 记超声波检查结果不正常者患有该疾病的概率为$p$，求$p$的估计值；
  + 根据小概率值$alpha=0.001$的独立性检验，分析超声波检查结果是否与患该疾病有关.
  #text-figure(
    top: 10pt,
    figure: table(
      columns: 4,
      [$P(chi^2 gt.slant k)$], [0.005], [0.010], [0.001],
      [$k$], [3.841], [6.635], [10.828],
    ),
  )[附：$chi^2 = n(a d - b c)^2 / ((a + b)(c + d)(a + c)(b + d))$]
]

#question(points: 15, bottom: 1in)[
  设数列 \${a_n}$ 满足 $a_1 = 3"， "a_(n+1) / n = a_n / (n+1) + 1 / (n(n+1))$.
  + 证明：\${n a_n}$ 为等差数列；
  + 设 $f(x) = a_1x + a_2x^2 + dots.c + a_m x^m，求 f'(-2)$.
]

#question(points: 15, bottom: 1in)[
  如图所示的四棱锥 $P - A B C D$ 中，$P A perp "平面" A B C D, B C parallel A D, A B perp A D$.
  + 证明：平面 $P A B perp "平面" P A D$
  + 若 $P A = A B = sqrt(2), A D = sqrt(3) + 1, B C = 2$，$P, B, C, D$ 在同一个球面上，设该球面的球心为 $O$.
    #text-figure(
      figure: image("17.png", height: 1.6in),
    )[
      + 证明：$O$ 在平面 $A B C D$上；
      + 求直线 $A C$ 与直线 $P O$ 所成角的余弦值.
    ]
]

#question(points: 17, bottom: 1in)[
  设椭圆 $C: x^2 / a^2 + y^2 / b^2 = 1 (a > b > 0)$，记 $A$为椭圆下端点，$B$ 为右端点，$|A B|= sqrt(10)$，且椭圆 $C$
  的离心率为 $(2sqrt(2)) / 3$.
  + 求椭圆的标准方程；
  + 设点 $P(m, n)$.
    + 若 $P$ 不在 $y$ 轴上，设 $R$ 是射线 $A P$ 上一点，$|A R| dot |A P| = 3$，用 $m, n$ 表示点 $R$ 的坐标；
    + 设直线$O Q$ 的斜率为 $k_1$，直线 $O P$ 的斜率为 $k_2$，若 $k_1 = 3k_2$，$M$为椭圆上一点，求 $|P M|$ 的最大值.
]

#question(points: 17)[
  设函数 $f(x) = 5cos x - cos 5x$.
  + 求 $f(x)$ 在 $[0, pi / 4]$ 的最大值；
  + 给定 $theta in (0,pi)，a$ 为实数，证明：存在 $y in [a - theta, a + theta]$，使得 $cos y lt.slant cos theta$；
  + 若存在 $phi$，使得对任意 $x$，都有 $5cos x - cos(5x + phi) lt.slant b$，求 $b$ 的最小值.
]
`
  }),
  generateTypstSource: (values: Record<string, unknown>) => {
    const v = values as unknown as TestpaperValues;
    const year = parseYear(v.year);
    const fullTitle = `${year}年${v.title}`;

    const kvEntries = (v.examInfo ?? [])
      .filter((e: KvEntry) => e.key.trim() !== '')
      .map((e: KvEntry) => `${escapeTypst(e.key)}: "${escapeTypst(e.value)}"`)
      .join(', ');

    const watermarkExt = issuerExt(v.issuer);
    const watermarkScale = getLogoScales()[v.issuer] ?? 1;
    const isA4 = v.paperSize === 'a4';
    const watermarkWidth = isA4 ? '40%' : '20%';
    const paperVar = isA4 ? 'a4' : 'a3';

    const lines: string[] = [
      '#import "@this/ezexam:0.3.2": *',
      '',
      '#show: setup.with(',
      '  mode: EXAM,',
      `  paper: ${paperVar},`,
      `  show-answer: ${v.showAnswer ? 'true' : 'false'},`,
      `  par-justify: ${v.parJustify ? 'true' : 'false'},`,
      ')',
      '',
      `#set page(background: place(center + horizon, block(width: ${watermarkWidth}, image("watermark-${v.issuer}.${watermarkExt}", width: ${watermarkScale} * 100%))))`,
      '',
      `#chapter[${escapeTypst(fullTitle)}]`,
      `#title[${escapeTypst(fullTitle)}]`,
      `#subject[${escapeTypst(v.subject)}]`
    ];

    if (v.secret.trim()) {
      lines.push(`#secret(body: [${escapeTypst(v.secret)}★启用前])`);
    }

    if (v.showScoreBox) {
      lines.push('#score-box(y: .5in)');
    }

    if (v.examType.trim()) {
      lines.push(`#exam-type[${escapeTypst(v.examType)}]`);
    }

    if (kvEntries) {
      lines.push(`#exam-info(info: (${kvEntries}))`);
    }

    if (v.examDuration.trim()) {
      lines.push(
        `#let exam-duration = "${escapeTypst(v.examDuration)}"`,
        '#exam-info(info: (考试时间: [#exam-duration], 总分: [#total-pts 分]))'
      );
    } else {
      lines.push(`#exam-info(info: (总分: [#total-pts 分]))`);
    }

    lines.push('', v.docContent);

    return lines.join('\n');
  },
  getFileName: (values: Record<string, unknown>) => {
    const v = values as unknown as TestpaperValues;
    const year = parseYear(v.year);
    return `${year}年${v.title} ${v.subject}.pdf`;
  }
};
