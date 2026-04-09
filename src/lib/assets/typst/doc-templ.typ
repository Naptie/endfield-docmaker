#import "@preview/cuti:0.3.0": fakebold, show-cn-fakebold
#import "@preview/numbly:0.1.0": numbly
#import "tuzhang.typ": circular_seal

#let pure-v(length) = block(v(length), width: 100%, outset: 0pt, inset: 0pt, below: 0pt, spacing: 0pt)
#let pure-red = rgb(210, 0, 0)

#let noindent() = h(-2em)

#let official-doc(
  copy-no: 1,
  ref-no: 1,
  conf-level: "机密",
  conf-period: "1年",
  urgen-level: "平件",
  authority: none,
  authorities: none,
  stamp-icon: none,
  stamp-shift: (-12mm, -18mm),
  stamp-rotation: -10deg,
  issuer: "✕✕✕",
  title: "✕✕✕✕✕关于✕✕✕✕✕✕的通知",
  issue-date: datetime.today(),
  content,
) = {
  assert(authority != none or authorities != none, message: "Either 'authority' or 'authorities' must be specified")
  let resolved-authorities = if authorities != none { authorities } else { (authority,) }
  set page(binding: left, margin: (inside: 28mm, outside: 26mm, top: 37mm, bottom: 35mm))

  set page(numbering: (..x) => {
    let x = x.pos().at(0)
    set align(right) if calc.odd(x)
    set align(left) if not calc.odd(x)
    set text(14pt)
    if (calc.even(x)) {
      "　"
    }
    "- " + str(x) + " -"
    if (calc.odd(x)) {
      "　"
    }
  })

  set text(font: "FangSong", size: 16pt, lang: "zh")

  if (conf-level != none and conf-period != none) or urgen-level != none {
    place(left + top)[
      #let no-str = "0" * (6 - str(copy-no).len()) + str(copy-no)

      #set text(font: "SimHei")
      #no-str \
      #if conf-level != none and conf-period != none {
        [#conf-level★#conf-period \ ]
      }
      #if urgen-level != none {
        urgen-level
      }
    ]

    pure-v(35mm)
  }

  align(center, {
    set text(font: "FZXiaoBiaoSong-B05", size: 35.95pt, fill: pure-red)
    if authority != none or resolved-authorities.len() == 1 {
      block(resolved-authorities.first() + "文件")
    } else {
      grid(
        columns: (auto, auto),
        align: (center, horizon),
        column-gutter: 0.1em,
        row-gutter: 0.1em,
        resolved-authorities.first(),
        grid.cell(rowspan: resolved-authorities.len(), "文件"),
        ..resolved-authorities.slice(1),
      )
    }
  })

  pure-v(20mm)

  align(
    center,
    block(text(size: 16pt, issuer + "〔" + str(issue-date.year()) + "〕" + str(ref-no) + "号")),
  )

  line(length: 100%, stroke: 3pt + pure-red)

  pure-v(20mm)

  align(
    center,
    block(text(size: 22pt, font: "FZXiaoBiaoSong-B05", title)),
  )

  pure-v(10mm)

  set par(first-line-indent: (all: true, amount: 2em))
  let fakepar = context {
    let b = par(box())
    b
    v(-measure(b + b).height)
  }
  show math.equation.where(block: true): it => it + fakepar // 公式后缩进
  show heading: it => it + fakepar // 标题后缩进
  show figure: it => it + fakepar // 图表后缩进
  show enum: it => it + fakepar
  show list: it => it + fakepar // 列表后缩进

  set enum(indent: 2em)

  set heading(
    numbering: numbly(
      (..x) => {
        h(2em)
        numbering("一、", x.pos().first())
        h(-0.3em)
      },
      (..x) => {
        h(2em)
        numbering("（一）", x.pos().at(1))
        h(-0.3em)
      },
      "　　{3}.",
      (..x) => {
        h(2em)
        numbering("（1）", x.pos().at(3))
        h(-0.3em)
      },
    ),
  )

  show heading: it => {
    set text(size: 16pt, weight: "regular")
    set text(font: "SimHei") if it.level == 1
    set text(font: "KaiTi") if it.level == 2
    it
  }

  set text(tracking: -0.5pt)
  set par(spacing: 0.655em, justify: true)
  set text(top-edge: "cap-height", bottom-edge: -0.52em)
  show heading: set block(spacing: 0.655em)

  show: show-cn-fakebold
  content

  v(7em)

  align(right)[
    #box[
      #if stamp-icon != none {
        place(
          center + horizon,
          dx: stamp-shift.first(),
          dy: stamp-shift.last(),
          rotate(stamp-rotation, circular_seal(
            if authority != none { authority } else { resolved-authorities.first() },
            stamp-icon,
            main_text_size: 1.2em,
            inner_ring_width: 0pt,
            show_star: false,
            text_color: pure-red,
            border_color: pure-red,
            star_color: pure-red,
          )),
        )
      }
      #set par(first-line-indent: 0em)
      #align(left)[
        #for a in resolved-authorities {
          a
          linebreak()
        }
        #issue-date.display("[year padding:none]年[month padding:none]月[day padding:none]日")
      ]
    ]
  ]
}
