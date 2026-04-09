// Credit: Lonyou (https://github.com/Vkango)

#let circular_seal(
  // 主要参数
  main_text, // 主文字（上方弧形）
  center_content, // 中心内容（文字、图片等任意 content）
  sub_text: none, // 副文字（下方弧形）
  // 尺寸参数
  outer_radius: 72pt, // 外圆半径
  inner_border_width: 1.5pt, // 内边线宽度
  inner_ring_width: 1pt, // 内环线宽度
  // 颜色参数
  border_color: red, // 边线颜色
  text_color: red, // 文字颜色
  star_color: red, // 五角星颜色
  // 文字大小
  main_text_size: 18pt, // 主文字大小
  sub_text_size: 15pt, // 副文字大小
  // 五角星参数
  star_size: 20pt, // 五角星大小
  show_star: true, // 是否显示五角星
  // 弧度参数
  main_max_arc: 240deg, // 主文字最大弧度
  sub_max_arc: 120deg, // 副文字最大弧度
) = context {
  set text(font: "STSong")

  let create_star(size: 8pt, color: red) = {
    let star_points = ()
    for i in range(5) {
      let angle1 = i * 72deg - 90deg
      let angle2 = (i + 0.5) * 72deg - 90deg
      star_points.push((calc.cos(angle1) * size, calc.sin(angle1) * size))
      star_points.push((calc.cos(angle2) * size * 0.4, calc.sin(angle2) * size * 0.4))
    }

    polygon(..star_points, fill: color, stroke: none)
  }

  let circular_text(text_content, radius, start_angle: -90deg, is_top: true, text_size: 10pt, max_arc: 240deg) = {
    let chars = text_content.clusters()
    let n = chars.len()
    if n == 0 { return () }

    // Measure a sample character for natural spacing
    let sample = text(size: text_size, weight: "bold")[字]
    let char_w = measure(sample).width
    let char_h = measure(sample).height

    // Natural per-char angle based on character width with slight gap
    let natural_angle_per_char = (char_w * 1.2) / radius * 1rad
    let natural_total = natural_angle_per_char * n
    // Total angle: natural spacing, capped at max_arc
    let total_angle = calc.min(max_arc, natural_total)
    let angle_step = if n > 1 { total_angle / (n - 1) } else { 0deg }

    // If text overflows max_arc, compress each character horizontally
    let x_scale = if natural_total > max_arc {
      max_arc / natural_total * 100%
    } else {
      100%
    }

    // Bounding box for placing each character (large enough for rotated glyph)
    let cell = calc.max(char_w, char_h) * 1.2

    let positioned_chars = ()
    for (i, char) in chars.enumerate() {
      let angle = if n > 1 {
        start_angle - total_angle / 2 + angle_step * i
      } else {
        start_angle
      }
      let x = calc.cos(angle) * radius
      let y = calc.sin(angle) * radius
      let rotation_angle = if is_top { angle + 90deg } else { angle - 90deg }

      positioned_chars.push(
        place(
          dx: x - cell / 2,
          dy: y - cell / 2,
          box(
            width: cell,
            height: cell,
            align(
              center + horizon,
              rotate(rotation_angle, scale(x: x_scale, y: 100%, origin: center + horizon, text(
                size: text_size,
                fill: text_color,
                weight: "bold",
              )[#char])),
            ),
          ),
        ),
      )
    }

    return positioned_chars
  }

  let diameter = 2 * outer_radius
  box(width: diameter, height: diameter, {
    place(center + horizon, {
      place(center + horizon, circle(radius: outer_radius, stroke: border_color + 2pt, fill: none))
      place(center + horizon, circle(
        radius: outer_radius - 3pt,
        stroke: border_color + 0.5pt,
        fill: none,
      ))
      place(center + horizon, circle(
        radius: outer_radius - 32pt,
        stroke: border_color + inner_ring_width,
        fill: none,
      ))

      for char_elem in circular_text(
        main_text,
        outer_radius - 20pt,
        start_angle: -90deg,
        is_top: true,
        text_size: main_text_size,
        max_arc: main_max_arc,
      ) {
        char_elem
      }

      if sub_text != none {
        for char_elem in circular_text(
          sub_text,
          outer_radius - 16pt,
          start_angle: 90deg,
          is_top: false,
          text_size: sub_text_size,
          max_arc: sub_max_arc,
        ) {
          char_elem
        }
      }

      if show_star {
        place(center + horizon, {
          create_star(size: star_size, color: star_color)
        })
      }

      // Center content (text, image, or any content)
      place(center + horizon, center_content)
    })
  })
}
