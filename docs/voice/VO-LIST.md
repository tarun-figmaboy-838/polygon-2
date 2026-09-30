# Voice-over list — every line, by part and character

Every line the learner hears, taken from the code as it ships today (2026-09-30): the Momo + Polo story, the lesson, the Broken Path scene before Part 2, and the Frozen Rush game. Use it to cast, generate or record the voices, then hand the files back to be put in. The same rows, one per line, are in [vo-list-all.csv](vo-list-all.csv) for batch generation.

## At a glance

| Part | Character | Lines | Recorded now | To record |
|---|---|---|---|---|
| 1 Momo + Polo story | Narrator | 6 | placeholder (macOS voice) | 6 |
| 1 Momo + Polo story | Momo | 3 | placeholder (macOS voice) | 3 |
| 1 Momo + Polo story | Polo | 7 | placeholder (macOS voice) | 7 |
| 2 Lesson | Swiftee | 78 | 65 studio, 12 synthetic stand-ins, 1 with none | 13 (plus the 65 studio ones only if you want a new voice) |
| 3 The Broken Path | Swiftee | 2 (+1 optional) | borrowed from the game, in the game's voice | 2 |
| 4 Frozen Rush game | Game voice | 14 | the owner's recording | 0 (optional) |

**Must record:** 16 story takes, 13 lesson lines and 2 Broken Path lines, 31 files in all. Everything else already has a real recording and is listed so a new voice can cover the whole experience if you want one.

## How to deliver

- **One file per line**, named exactly as in the *File* column, as WAV (48 kHz or 44.1 kHz, 16-bit, mono). MP3 is fine too.
- **Say the line exactly as written.** The lesson finds a recording by its words, and the text on screen is drawn from the same words. Read numerals as words ("6 sides" is "six sides").
- About **250 ms of silence** at the start and the end, no music, no effects, no breaths at the edges.
- **Even loudness across all files**: peaks below -1.5 dBFS, speech around -19 dBFS RMS. The project converts each file to Ogg + MP3 itself (`npm run optimize:media -- <file> --speech`).
- A long line is recorded **whole**, as one take: the lesson and the story break it into short parts on screen themselves.

## The voices

| Character | Where | Voice |
|---|---|---|
| **Swiftee** | the lesson, the Broken Path | The teacher: a friendly little bird. Warm, bright and clear, encouraging, never babyish. Indian English, like the lesson's studio takes (for example `assets/audio/lesson/01_Look_A_point.mp3`). A steady classroom pace, about 140 words a minute. Leans on the key words (open, closed, straight, curved, polygon names). |
| **Narrator** | the Momo + Polo story | A storyteller: warm, calm, unhurried, about 120 words a minute. Indian English. |
| **Momo** | the Momo + Polo story | A small brave mammoth: a young boy's voice, warm and a little low for a child, earnest, sometimes unsure. |
| **Polo** | the Momo + Polo story | A polar bear cub: a bright, bouncy, higher child's voice, full of energy. |
| **Game voice** | Frozen Rush | The game itself, speaking to the child: warm and quick, never stern. Can be Swiftee's voice if you want one voice across the whole experience. |

## 1. The Momo + Polo story

Sixteen takes over nine scenes, one take per line part: the story shows one part at a time and plays its take. The current voices are placeholders made with the macOS voices.

| ID | Character | Line | Where | Delivery | File |
|---|---|---|---|---|---|
| S1.1 | Narrator | Long ago, | Scene 1 of 9 (warm music) | Warm, calm, unhurried: once upon a time. | `story-scene-1-1.wav` |
| S1.2 | Narrator | Momo the mammoth and Polo the polar bear | Scene 1 of 9 (warm music) | Introducing two friends, a smile in it. | `story-scene-1-2.wav` |
| S1.3 | Narrator | were best friends. | Scene 1 of 9 (warm music) | Fond and warm. | `story-scene-1-3.wav` |
| S2.1 | Narrator | One day, | Scene 2 of 9 (warm music) | A little lift: something is about to happen. | `story-scene-2-1.wav` |
| S2.2 | Narrator | Polo spotted something shiny | Scene 2 of 9 (warm music) | Curious, drawing the listener in. | `story-scene-2-2.wav` |
| S2.3 | Narrator | beneath the ice. | Scene 2 of 9 (warm music) | A hush of wonder. | `story-scene-2-3.wav` |
| S3.1 | Polo | Momo, look! | Scene 3 of 9 (warm music) | Excited, calling his friend over. | `story-scene-3-1.wav` |
| S3.2 | Polo | Something is buried here! | Scene 3 of 9 (warm music) | Thrilled, a discovery. | `story-scene-3-2.wav` |
| S4.1 | Momo | Let us pull it out! | Scene 4 of 9 (playful music) | Eager and brave, ready to help. | `story-scene-4-1.wav` |
| S5.1 | Polo | Almost there! | Scene 5 of 9 (playful music) | Straining, pulling hard, excited. | `story-scene-5-1.wav` |
| S5.2 | Polo | One more pull! | Scene 5 of 9 (playful music) | Effort and cheer together: nearly there. | `story-scene-5-2.wav` |
| S6.1 | Momo | Uh-oh... | Scene 6 of 9 (tension music), a worry moment | Small and cautious: the ice has just cracked. Slow. | `story-scene-6-1.wav` |
| S7.1 | Polo | Run! | Scene 7 of 9 (tension music), a shout moment | Urgent! A short shout, not a scream. | `story-scene-7-1.wav` |
| S8.1 | Momo | Polo! | Scene 8 of 9 (hush music), a shout moment | Calling across the crack, worried for his friend. | `story-scene-8-1.wav` |
| S9.1 | Polo | Momo, keep going! | Scene 9 of 9 (resolve music) | Brave and reassuring, calling from the far side. | `story-scene-9-1.wav` |
| S9.2 | Polo | I will find another way! | Scene 9 of 9 (resolve music) | Determined, hopeful. | `story-scene-9-2.wav` |

## 2. The lesson (Swiftee)

78 lines, in the order a learner first hears them. The *File* is the name the lesson already uses, so a new take drops straight in. Lines marked **Record** have no real recording yet.

| ID | Line | Where it plays | Delivery | File | Now |
|---|---|---|---|---|---|
| L01 | Look! A point. | Screen 1 (01 · Point): instruction | Clear and inviting: a question to the child, or a thing to look at. | `01_Look_A_point.wav` | Studio recording |
| L02 | Woah! It drew a shape. | Screen 2 (01 · Shape): instruction | Clear and inviting: a question to the child, or a thing to look at. | `02_Woah_It_drew_a_shape.wav` | Studio recording |
| L03 | Let's look at this shape closely. | Screen 3 (01 · Closer): instruction | Clear and inviting: a question to the child, or a thing to look at. | `03_Lets_look_at_this_shape_closely.wav` | Studio recording |
| L04 | There are no gaps in its boundary. | Screen 4 (01 · Boundary): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: gaps, boundary. | `04_There_are_no_gaps_in_its_boundary.wav` | Studio recording |
| L05 | Is it open or closed? | Screen 5 (01 · Open or closed): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: open, closed. | `05_Is_it_open_or_closed.wav` | Studio recording |
| L06 | No gaps in its boundary. This shape is closed. | Screens 5-9: after a wrong pick, explains the answer (closed) | Patient, explaining, calm. Stress: gaps, boundary, closed. | `48_No_gaps_in_its_boundary_This_shape_is_closed.wav` | Studio recording |
| L07 | There is a gap in its boundary. It is open. | Screens 5-9: after a wrong pick, explains the answer (open) | Patient, explaining, calm. Stress: gap, boundary, open. | `49_There_is_a_gap_in_its_boundary_It_is_open.wav` | Studio recording |
| L08 | Yes! It is closed. | Screens 5-9: right answer (the shape is closed) | Delighted, warm praise. A real smile, not a cheer. Stress: closed. | `66_Yes_It_is_closed.wav` | Studio recording |
| L09 | Yes! It is open. | Screens 5-9: right answer (the shape is open) | Delighted, warm praise. A real smile, not a cheer. Stress: open. | `67_Yes_It_is_open.wav` | Studio recording |
| L10 | Is this shape open or closed? | Screen 6 (02 · Open or closed): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: open, closed. | `06_Is_this_shape_open_or_closed.wav` | Studio recording |
| L11 | What about this one? | Screen 7 (03 · Open or closed): instruction | Clear and inviting: a question to the child, or a thing to look at. | `07_What_about_this_one.wav` | Studio recording |
| L12 | And this? | Screen 8 (04 · Open or closed): instruction | Clear and inviting: a question to the child, or a thing to look at. | `08_And_this.wav` | Studio recording |
| L13 | How about this one? | Screen 9 (05 · Open or closed): instruction | Clear and inviting: a question to the child, or a thing to look at. | `09_How_about_this_one.wav` | Studio recording |
| L14 | These two shapes are open... | Screen 10 (06 · Open figures): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: open. | `10_These_two_shapes_are_open.wav` | Studio recording |
| L15 | ...and these two shapes are closed. | Screen 11 (06 · Closed figures): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: closed. | `11_and_these_two_shapes_are_closed.wav` | Studio recording |
| L16 | Look! The boundaries of the shapes are different too. | Screen 12 (06 · Boundaries): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: boundaries. | `12_Look_The_boundaries_of_the_shapes_are_different_too.wav` | Studio recording |
| L17 | Some are straight and some are curved. | Screen 13 (06 · Straight or curved): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: straight, curved. | `13_Some_are_straight_and_some_are_curved.wav` | Studio recording |
| L18 | Which boundaries are straight and which are curved? | Screen 14 (06 · Classify): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: boundaries, straight, curved. | `14_Which_boundaries_are_straight_and_which_are_curved.wav` | Studio recording |
| L19 | Look! This boundary isn't curved. It is made of straight lines. | Screen 14 (06 · Classify): wrong pick: chose Curved for a straight boundary | Patient, explaining, calm. Stress: boundary, curved, straight. | `68_Look_This_boundary_isnt_curved_It_is_made_of_straight_lines.wav` | Studio recording |
| L20 | Look closely. This boundary bends smoothly. It is curved. | Screen 14 (06 · Classify): wrong pick: chose Straight for a curved boundary | Patient, explaining, calm. Stress: boundary, curved. | `69_Look_closely_This_boundary_bends_smoothly_It_is_curved.wav` | Studio recording |
| L21 | Is the boundary straight or curved? | Screen 14 (06 · Classify): the question again, after a wrong pick | Clear and inviting: a question to the child, or a thing to look at. Stress: boundary, straight, curved. | `88_Is_the_boundary_straight_or_curved.wav` | **Record** — None: the browser speech voice reads it |
| L22 | You got it! These boundaries are straight, while these are curved. | Screen 15 (06 · Well done): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: boundaries, straight, curved. | `15_You_got_it_These_boundaries_are_straight_while_these_are_curve.wav` | Studio recording |
| L23 | Tap the closed figure made with straight lines. | Screen 16 (07 - Find the polygon): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: closed, straight. | `80_Tap_the_closed_figure_made_with_straight_lines.wav` | **Record** — Stand-in: Windows Zira synthetic voice |
| L24 | Yes! It is closed and made of straight lines. | Screen 16 (07 - Find the polygon): right answer | Delighted, warm praise. A real smile, not a cheer. Stress: closed, straight. | `70_Yes_It_is_closed_and_made_of_straight_lines.wav` | Studio recording |
| L25 | Not quite. Look for a figure with no gaps and no curves. | Screen 16 (07 - Find the polygon): first wrong try | Gentle and encouraging. Never disappointed; a small nudge. Stress: gaps, curves. | `50_Not_quite_Look_for_a_figure_with_no_gaps_and_no_curves.wav` | Studio recording |
| L26 | We call this a polygon. | Screen 17 (08 · Polygon): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: polygon. | `17_We_call_this_a_polygon.wav` | Studio recording |
| L27 | A closed figure made of only straight line segments is called a polygon. | Screen 18 (09 · Definition): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: closed, straight, segments, polygon. | `18_A_closed_figure_made_of_only_straight_line_segments_is_called.wav` | Studio recording |
| L28 | Which of these figures are polygons? | Screen 19 (10 · Which are polygons): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: polygons. | `19_Which_of_these_figures_are_polygons.wav` | Studio recording |
| L29 | Great job! You identified all the polygons. | Screen 19 (10 · Which are polygons): right answer | Delighted, warm praise. A real smile, not a cheer. Stress: polygons. | `81_Great_job_You_identified_all_the_polygons.wav` | **Record** — Stand-in: Windows Zira synthetic voice |
| L30 | A polygon is closed, with only straight sides. | Screen 19 (10 · Which are polygons): first wrong try | Gentle and encouraging. Never disappointed; a small nudge. Stress: polygon, closed, straight, sides. | `72_A_polygon_is_closed_with_only_straight_sides.wav` | Studio recording |
| L31 | These line segments are the sides of the polygon. | Screen 20 (11 · Sides): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: segments, sides, polygon. | `20_These_line_segments_are_the_sides_of_the_polygon.wav` | Studio recording |
| L32 | The point where two sides meet is called a vertex. | Screen 21 (11 · Vertex): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: sides, vertex. | `21_The_point_where_two_sides_meet_is_called_a_vertex.wav` | Studio recording |
| L33 | When two sides meet, they also form an angle. | Screen 22 (11 · Angle): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: sides, angle. | `22_When_two_sides_meet_they_also_form_an_angle.wav` | Studio recording |
| L34 | Label the parts of the polygon. | Screen 23 (12 · Label the parts): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: polygon. | `23_Label_the_parts_of_the_polygon.wav` | Studio recording |
| L35 | Perfect! Side, vertex and angle — all labelled. | Screen 23 (12 · Label the parts): right answer (all three labels placed) | Delighted, warm praise. A real smile, not a cheer. Stress: vertex, angle. | `73_Perfect_Side_vertex_and_angle_all_labelled.wav` | Studio recording |
| L36 | Let's count the sides of the polygon. | Screen 24 (13 · How many sides): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: sides, polygon. | `88_Lets_count_the_sides_of_the_polygon.wav` | **Record** — Stand-in: Windows Heera synthetic voice |
| L37 | Count each side carefully and try again. | Screens 24, 31: first wrong try | Gentle and encouraging. Never disappointed; a small nudge. Stress: side. | `51_Count_each_side_carefully_and_try_again.wav` | Studio recording |
| L38 | Correct! This polygon has 5 sides. | Screen 25 (13 · Five sides): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: polygon, sides. | `82_Correct_This_polygon_has_five_sides.wav` | **Record** — Stand-in: Windows Zira synthetic voice |
| L39 | Now let's change how it looks. | Screen 26 (14 · Change it): instruction | Clear and inviting: a question to the child, or a thing to look at. | `26_Now_lets_change_how_it_looks.wav` | Studio recording |
| L40 | Drag any vertex. Stretch it, squash it, or resize it. | Screen 27 (14 · Drag a vertex): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: vertex. | `27_Drag_any_vertex_Stretch_it_squash_it_or_resize_it.wav` | Studio recording |
| L41 | Whoa! It looks quite different now. | Screen 28 (14 · Changed): instruction | Clear and inviting: a question to the child, or a thing to look at. | `28_Whoa_It_looks_quite_different_now.wav` | Studio recording |
| L42 | Its appearance has completely changed. | Screen 29 (15 · Before and after): instruction | Clear and inviting: a question to the child, or a thing to look at. | `29_Its_appearance_has_completely_changed.wav` | Studio recording |
| L43 | But not everything has changed. | Screen 30 (15 · Not everything): instruction | Clear and inviting: a question to the child, or a thing to look at. | `30_But_not_everything_has_changed.wav` | Studio recording |
| L44 | Let's count the sides again. | Screen 31 (16 · Count again): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: sides. | `31_Lets_count_the_sides_again.wav` | Studio recording |
| L45 | Both polygons still have 5 sides. | Screen 32 (16 · Still five): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: polygons, sides. | `32_Both_polygons_still_have_five_sides.wav` | Studio recording |
| L46 | So the number of sides gives us a good way to name polygons. | Screen 33 (16 · Naming): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: sides, polygons. | `33_So_the_number_of_sides_gives_us_a_good_way_to_name_polygons.wav` | Studio recording |
| L47 | A polygon with 3 sides is called a triangle. | Screen 34 (17 · Triangle): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: polygon, sides, triangle. | `34_A_polygon_with_three_sides_is_called_a_triangle.wav` | Studio recording |
| L48 | A polygon with 4 sides is called a quadrilateral. | Screen 35 (17 · Quadrilateral): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: polygon, sides, quadrilateral. | `35_A_polygon_with_four_sides_is_called_a_quadrilateral.wav` | Studio recording |
| L49 | Select all the quadrilaterals. | Screen 36 (18 · Quadrilaterals): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: quadrilaterals. | `36_Select_all_the_quadrilaterals.wav` | Studio recording |
| L50 | That’s right! Quadrilaterals are polygons with 4 sides. | Screen 36 (18 · Quadrilaterals): right answer | Delighted, warm praise. A real smile, not a cheer. Stress: polygons, sides. | `83_Thats_right_Quadrilaterals_are_polygons.wav` | **Record** — Stand-in: Windows Zira synthetic voice |
| L51 | Quadrilaterals are polygons with 4 sides. | Screen 36 (18 · Quadrilaterals): first wrong try | Gentle and encouraging. Never disappointed; a small nudge. Stress: polygons, sides. | `84_Quadrilaterals_are_polygons_with_four_sides.wav` | **Record** — Stand-in: Windows Zira synthetic voice |
| L52 | Is this shape a quadrilateral? | Screen 36 (18 · Quadrilaterals): second wrong try | Patient and kind; gives the answer away a little more. Stress: quadrilateral. | `85_Is_this_shape_a_quadrilateral.wav` | **Record** — Stand-in: Windows Zira synthetic voice |
| L53 | A polygon with 5 sides is called a pentagon. | Screen 37 (19 · Pentagon): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: polygon, sides, pentagon. | `37_A_polygon_with_five_sides_is_called_a_pentagon.wav` | Studio recording |
| L54 | A polygon with 6 sides is called a hexagon. | Screen 38 (20 · Hexagon): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: polygon, sides, hexagon. | `38_A_polygon_with_six_sides_is_called_a_hexagon.wav` | Studio recording |
| L55 | A polygon with 7 sides is called a heptagon. | Screen 39 (21 · Heptagon): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: polygon, sides, heptagon. | `39_A_polygon_with_seven_sides_is_called_a_heptagon.wav` | Studio recording |
| L56 | A polygon with 8 sides is called an octagon. | Screen 40 (22 · Octagon): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: polygon, sides, octagon. | `40_A_polygon_with_eight_sides_is_called_an_octagon.wav` | Studio recording |
| L57 | Let's recall the different types of polygons we learnt about. | Screen 41 (23 · Recall): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: polygons. | `41_Lets_recall_the_different_types_of_polygons_we_learnt_about.wav` | Studio recording |
| L58 | A polygon is a closed figure made only of straight sides. | Screen 42 (Polygon summary): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: polygon, closed, straight, sides. | `86_A_polygon_is_a_closed_figure.wav` | **Record** — Stand-in: Windows Zira synthetic voice |
| L59 | Which of these are polygons? | Screen 43 (CFU 1): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: polygons. | `77_Select_polygons.wav` | **Record** — Stand-in: Windows Zira synthetic voice |
| L60 | Yes! Closed, with only straight sides. | Screen 43 (CFU 1): right answer | Delighted, warm praise. A real smile, not a cheer. Stress: straight, sides. | `52_Yes_Closed_with_only_straight_sides.wav` | Studio recording |
| L61 | Not quite! A polygon is closed with only straight sides. | Screen 43 (CFU 1): first wrong try | Gentle and encouraging. Never disappointed; a small nudge. Stress: polygon, closed, straight, sides. | `87_Not_quite_A_polygon_is_closed.wav` | **Record** — Stand-in: Windows Zira synthetic voice |
| L62 | Classify the figures as a polygon or not a polygon. | Screen 44 (CFU 2): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: polygon. | `43_Classify_the_figures_as_a_polygon_or_not_a_polygon.wav` | Studio recording |
| L63 | Great job! You sorted the figures correctly. | Screen 44 (CFU 2): right answer | Delighted, warm praise. A real smile, not a cheer. | `55_Great_job_You_sorted_the_figures_correctly.wav` | Studio recording |
| L64 | Wrong group. Check for gaps or curved sides. | Screen 44 (CFU 2): first wrong try | Gentle and encouraging. Never disappointed; a small nudge. Stress: gaps, curved, sides. | `56_Wrong_group_Check_for_gaps_or_curved_sides.wav` | Studio recording |
| L65 | Polygons are closed, with only straight sides. Try again. | Screen 44 (CFU 2): second wrong try | Patient and kind; gives the answer away a little more. Stress: closed, straight, sides. | `57_Polygons_are_closed_with_only_straight_sides_Try_again.wav` | Studio recording |
| L66 | Which figure is NOT a polygon? | Screen 45 (CFU 3): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: NOT, polygon. Read NOT with emphasis. | `78_Not_a_polygon.wav` | **Record** — Stand-in: Windows Zira synthetic voice |
| L67 | You found it! That is not a polygon. | Screen 45 (CFU 3): right answer | Delighted, warm praise. A real smile, not a cheer. Stress: polygon. | `58_You_found_it_That_is_not_a_polygon.wav` | Studio recording |
| L68 | Which figure breaks the rule for a polygon? | Screen 45 (CFU 3): first wrong try | Gentle and encouraging. Never disappointed; a small nudge. Stress: polygon. | `59_Which_figure_breaks_the_rule_for_a_polygon.wav` | Studio recording |
| L69 | Is it closed? Does it have only straight sides? | Screen 45 (CFU 3): second wrong try | Patient and kind; gives the answer away a little more. Stress: closed, straight, sides. | `53_Is_it_closed_Does_it_have_only_straight_sides.wav` | Studio recording |
| L70 | Which of these are pentagons? | Screen 46 (CFU 4): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: pentagons. | `79_Select_pentagons.wav` | **Record** — Stand-in: Windows Zira synthetic voice |
| L71 | Exactly! A pentagon always has 5 sides. | Screen 46 (CFU 4): right answer | Delighted, warm praise. A real smile, not a cheer. Stress: pentagon, sides. | `60_Exactly_A_pentagon_always_has_five_sides.wav` | Studio recording |
| L72 | Count the sides of each figure carefully. | Screen 46 (CFU 4): first wrong try | Gentle and encouraging. Never disappointed; a small nudge. Stress: sides. | `61_Count_the_sides_of_each_figure_carefully.wav` | Studio recording |
| L73 | Look for every figure with exactly 5 sides. | Screen 46 (CFU 4): second wrong try | Patient and kind; gives the answer away a little more. Stress: sides. | `62_Look_for_every_figure_with_exactly_five_sides.wav` | Studio recording |
| L74 | Classify each figure as a hexagon or a heptagon. | Screen 47 (CFU 5): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: hexagon, heptagon. | `46_Classify_each_figure_as_a_hexagon_or_a_heptagon.wav` | Studio recording |
| L75 | Well done! Hexagons have 6 sides and heptagons have 7 sides. | Screen 47 (CFU 5): right answer | Delighted, warm praise. A real smile, not a cheer. Stress: sides, heptagons. | `63_Well_done_Hexagons_have_six_sides_and_heptagons_have_seven_sid.wav` | Studio recording |
| L76 | Count the sides of the ones you placed wrong. | Screen 47 (CFU 5): first wrong try | Gentle and encouraging. Never disappointed; a small nudge. Stress: sides. | `64_Count_the_sides_of_the_ones_you_placed_wrong.wav` | Studio recording |
| L77 | 6 sides make a hexagon, 7 make a heptagon. | Screen 47 (CFU 5): second wrong try | Patient and kind; gives the answer away a little more. Stress: sides, hexagon, heptagon. | `65_Six_sides_make_a_hexagon_seven_make_a_heptagon.wav` | Studio recording |
| L78 | You did it! Now you know what makes a figure a polygon. | Screen 48 (Finished): instruction | Clear and inviting: a question to the child, or a thing to look at. Stress: polygon. | `47_You_did_it_Now_you_know_what_makes_a_figure_a_polygon.wav` | Studio recording |

## 3. The Broken Path (Swiftee)

The scene between the lesson and the game. Swiftee's two lines currently play the game's own recordings of them, in the game's voice, so they should be recorded in hers.

| ID | Line | Where it plays | Delivery | File | Now |
|---|---|---|---|---|---|
| B1 | Oh no! The path is broken. | The Broken Path, after Momo stops at the edge: her first line | Concerned but calm, looking at the gap. Stress: broken. | `bridge-1-path-is-broken.wav` | Borrowed: the game's recorded take (tut-5-broken), in the game's voice, not Swiftee's |
| B2 | Help Momo cross the Frozen Pass! | The Broken Path: her second line, then Next appears | Encouraging, a call to action to the child: let's go! Stress: Frozen Pass. | `bridge-2-help-momo-cross.wav` | Borrowed: the game's recorded take (tut-2-goal), in the game's voice, not Swiftee's |
| B2-alt | Let's use what we learned to help Momo cross. | Optional: instead of B2, to link the lesson to the game (the line suggested in the brief) | Warm, confident, a teacher to her class. Stress: what we learned. | `bridge-2-alt-use-what-we-learned.wav` | Not used yet; no recording |

## 4. Frozen Rush (the game's voice)

Recorded by the owner as one take. Listed so a new voice can match the rest; record these only if you want to replace it. The interface words (Play, Paused, Resume and the rest) are not voiced.

| ID | Line | Where it plays | Delivery | File |
|---|---|---|---|---|
| tut-1-meet | This is Momo. He needs to find his friend. | Tutorial, first crossing: The run starts; Momo is lit. | The game's voice: warm and quick, never stern. Under two seconds where possible. | `tut-1-meet.wav` |
| tut-2-goal | Help Momo cross the Frozen Pass! | Tutorial, first crossing: Still at the start. | The game's voice: warm and quick, never stern. Under two seconds where possible. | `tut-2-goal.wav` |
| tut-3-watch | Watch out! | Tutorial, first crossing: A rock is right in his path. | The game's voice: warm and quick, never stern. Under two seconds where possible. | `tut-3-watch.wav` |
| tut-4-jump | Tap to jump over obstacles. | Tutorial, first crossing: The box alone, in the middle of the stage; no hand — the whole stage is the control. | The game's voice: warm and quick, never stern. Under two seconds where possible. | `tut-4-jump.wav` |
| tut-5-broken | Oh no! The path is broken. | Tutorial, first crossing: He has stopped and trembled; the hole is lit. | The game's voice: warm and quick, never stern. Under two seconds where possible. | `tut-5-broken.wav` |
| tut-6-use | Use the right ice piece to fix the path. | Tutorial, first crossing: The hand sweeps across the answer's rope. | The game's voice: warm and quick, never stern. Under two seconds where possible. | `tut-6-use.wav` |
| tut-7-fit | Perfect fit! Keep going! | Tutorial, first crossing: The piece has landed and the run resumes. | The game's voice: warm and quick, never stern. Under two seconds where possible. | `tut-7-fit.wav` |
| sign-triangle | Cut the triangle. | The instruction sign, crossing 1 | Say the shape name with emphasis: it is shown in capitals and coloured. | `sign-triangle.wav` |
| sign-quadrilateral | Cut the quadrilateral. | The instruction sign, crossing 2 | Say the shape name with emphasis: it is shown in capitals and coloured. | `sign-quadrilateral.wav` |
| sign-pentagon | Cut the pentagon. | The instruction sign, crossing 3 | Say the shape name with emphasis: it is shown in capitals and coloured. | `sign-pentagon.wav` |
| sign-hexagon | Cut the hexagon. | The instruction sign, crossing 4 | Say the shape name with emphasis: it is shown in capitals and coloured. | `sign-hexagon.wav` |
| sign-heptagon | Cut the heptagon. | The instruction sign, crossing 5 | Say the shape name with emphasis: it is shown in capitals and coloured. | `sign-heptagon.wav` |
| sign-pentagons | Cut all the pentagons. | The instruction sign, crossing 6 (two answers) | Say the shape name with emphasis: it is shown in capitals and coloured. | `sign-pentagons.wav` |
| sign-hexagons | Cut all the hexagons. | The instruction sign, crossing 7 (two answers) | Say the shape name with emphasis: it is shown in capitals and coloured. | `sign-hexagons.wav` |

## Putting the files in

| Part | Where the files go | What happens then |
|---|---|---|
| Story | the 16 takes | They are joined into one file, `assets/audio/story/story-voice` (.ogg + .mp3), with a table of where each take starts and when each word is said (`src/story/story-voice.js`). `tools/story/build-story-voice.py` does this for the placeholder voices and can do it for real takes. |
| Lesson | `assets/audio/lesson/`, the same names | Convert each to .ogg + .mp3 with the same name. Each line's word timings in `src/lesson/recordings.js` are then measured again (`tools/voice/extract-word-timings.cjs` and `import-word-timings.cjs`) so the words appear as they are said. The one new line (L21) also gets a row in that catalogue. |
| Broken Path | `assets/audio/bridge/` | `src/bridge/bridge-story.js` plays each line from a window of a recording, with its word times (`LINES`). It points at the game's take today; it is switched to Swiftee's two files and their word times. |
| Game | the 14 takes | The game plays one take, `game/assets/audio/vo-lines`, with a window per line (`CFG.vo.lines` in `game/js/engine.js`). New takes are joined into that file and the windows measured again (`tools/vo-split.mjs` and `vo-bake-words.mjs` in the running-mammoth repository). |

## Recordings that are no longer used

These 10 files are in `assets/audio/lesson/` but no screen says them any more (the lesson was rewritten). They do not need new takes.

- "Tap the figure that is both closed and made of straight lines." (`16_Tap_the_figure_that_is_both_closed_and_made_of_straight_lines.mp3`)
- "How many sides does this polygon have?" (`24_How_many_sides_does_this_polygon_have.mp3`)
- "This polygon has five sides." (`25_This_polygon_has_five_sides.mp3`)
- "Which of these is a polygon?" (`42_Which_of_these_is_a_polygon.mp3`)
- "Find the odd one out. Which figure is NOT a polygon?" (`44_Find_the_odd_one_out_Which_figure_is_NOT_a_polygon.mp3`)
- "Which of these is a pentagon?" (`45_Which_of_these_is_a_pentagon.mp3`)
- "A polygon is closed, with only straight sides. Try again." (`54_A_polygon_is_closed_with_only_straight_sides_Try_again.mp3`)
- "That is right! These are the ones." (`71_That_is_right_These_are_the_ones.mp3`)
- "Not that one. A side is straight, a vertex is a corner." (`74_Not_that_one_A_side_is_straight_a_vertex_is_a_corner.mp3`)
- "Not quite. Try again." (`75_Not_quite_Try_again.mp3`)
