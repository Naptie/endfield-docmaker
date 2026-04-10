// Credit: ParaN3xus (https://github.com/ParaN3xus)

#import "@preview/cuti:0.3.0": fakebold, show-cn-fakebold
#import "@preview/numbly:0.1.0": numbly
#import "@preview/suiji:0.5.1": gen-rng-f, random-f
#import "tuzhang.typ": circular_stamp

#let pure-v(length) = block(v(length), width: 100%, outset: 0pt, inset: 0pt, below: 0pt, spacing: 0pt)
#let dark-red = rgb(210, 0, 0)

#let noindent() = h(-2em)

#let fit-to-width(target-width, natural-width, body, char-count: 0) = {
  if char-count > 1 and natural-width < target-width {
    let extra = (target-width - natural-width) / (char-count - 1)
    set text(tracking: extra)
    body
  } else if natural-width > target-width {
    let ratio = target-width / natural-width * 100%
    box(width: target-width, scale(x: ratio, y: 100%, origin: center + horizon, box(width: natural-width, body)))
  } else {
    body
  }
}

#let arrange(amount, radius, (width, height)) = {
  let cols = if amount == 3 or amount > 4 { 3 } else { 2 }
  let gap = radius * 2
  let init-height = if amount > 6 { -height / 2 } else { -calc.abs(height / 2 - radius) }

  range(amount).map(i => {
    let col = calc.rem(i, cols)
    let row = calc.quo(i, cols)

    let count = calc.min(amount - row * cols, cols)

    (
      dx: width / 2 - radius * (cols + count - 1 - 2 * col),
      dy: init-height + row * gap,
    )
  })
}

#let official-doc(
  copy-no: 1,
  ref-no: 1,
  conf-level: "机密",
  conf-period: "1年",
  urgen-level: "平件",
  authorities: (),
  watermark-icon: none,
  issuer: "✕✕✕",
  title: "✕✕✕✕✕关于✕✕✕✕✕✕的通知",
  issue-date: datetime.today(),
  seed: 0,
  content,
) = {
  assert(authorities.len() > 0, message: "'authorities' must contain at least one entry")
  let authority-names = authorities.map(a => a.name)
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

  set page(background: if watermark-icon != none {
    place(center + horizon, block(width: 40%, watermark-icon))
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
    set text(font: "FZXiaoBiaoSong-B05", size: 36pt, fill: dark-red)
    let target-width = 156mm // 210mm (A4) - 28mm (inside) - 26mm (outside)
    context {
      if authority-names.len() == 1 {
        let title-text = authority-names.first() + "文件"
        let chars = title-text.clusters()
        let natural = chars.map(c => measure(c).width).sum()
        fit-to-width(target-width, natural, title-text, char-count: chars.len())
      } else {
        let wenjian-width = "文件".clusters().map(c => measure(c).width).sum()
        let gutter = measure(h(0.1em)).width
        let auth-target = target-width - wenjian-width - gutter

        let fitted = authority-names.map(a => {
          let chars = a.clusters()
          let natural = chars.map(c => measure(c).width).sum()
          fit-to-width(auth-target, natural, a, char-count: chars.len())
        })

        grid(
          columns: (auth-target, auto),
          align: (center, horizon),
          column-gutter: 0.1em,
          row-gutter: 0.1em,
          fitted.first(),
          grid.cell(rowspan: authority-names.len(), "文件"),
          ..fitted.slice(1),
        )
      }
    }
  })

  pure-v(20mm)

  align(
    center,
    block(text(size: 16pt, issuer + "〔" + str(issue-date.year()) + "〕" + str(ref-no) + "号")),
  )

  line(length: 100%, stroke: 3pt + dark-red)

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
  show raw: set text(font: "JetBrains Mono")
  content

  v(7em)

  align(right)[
    #box[
      #let text-content = [
        #set par(first-line-indent: 0em)
        #align(left)[
          #for a in authority-names {
            a
            linebreak()
          }
          #issue-date.display("[year padding:none]年[month padding:none]月[day padding:none]日")
        ]
      ]

      #context {
        if authorities.len() > 0 {
          let positions = arrange(authorities.len(), 72pt, measure(text-content))
          let rng = gen-rng-f(seed)
          let params = ()
          for i in range(authorities.len()) {
            let authority = authorities.at(i)
            let (dx, dy) = positions.at(i)
            (rng, params) = random-f(rng, size: 3)
            place(
              center + horizon,
              dx: dx + (3mm - params.at(0) * 6mm),
              dy: dy - params.at(1) * 5mm,
              rotate(8deg - params.at(2) * 16deg, circular_stamp(
                authority.name,
                authority.icon,
                inner_ring_width: 0pt,
                text_color: dark-red,
                border_color: dark-red,
              )),
            )
          }
        }

        text-content
      }
    ]
  ]
}
