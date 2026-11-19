# Bộ lời nhắc sinh tranh cảnh vật (InkDragon)

Dán nguyên từng khối vào Gemini hoặc ChatGPT. Lời nhắc viết bằng tiếng Anh vì mô hình ảnh hiểu tiếng Anh tốt hơn.

## Cách làm

1. Sinh **một** bức trăng trước (khối 1). Sinh lại tới khi anh ưng lối vẽ. Bức đó là **bức chuẩn**.
2. Từ bức thứ hai trở đi: đính kèm bức chuẩn và thêm câu này lên đầu lời nhắc:
   `Match the brushwork, ink tone and level of detail of the attached image exactly.`
3. Mỗi loại sinh 3 bức trước để em thử ghép vào game. Ổn thì mới sinh thêm.
4. Lưu PNG, cạnh dài từ 1024 px trở lên, vào `D:\Projects\InkDragon\web\assets\scene\`, đặt tên `moon-01.png`, `river-01.png`, `mountain-01.png`, `waterfall-01.png`, `pine-01.png`, `cloud-01.png`, `swirl-01.png`.

## Bức nào phải loại

Game đặt tranh lên giấy trắng theo kiểu "nhân màu": trắng thành trong suốt, mực giữ nguyên. Vì vậy loại bức nào có:

- nền ngả vàng, xám, hoặc có vân giấy (nền phải trắng tinh)
- triện đỏ, chữ ký, chữ thư pháp, khung viền
- vật bị cắt ở mép ảnh
- nhiều vật trong một ảnh (thêm chim, thuyền, người, mặt trời)
- màu ngoài đen xám

## Khối dùng chung

Mọi lời nhắc bên dưới đã gồm sẵn khối này, anh không cần dán riêng. Em để đây cho anh biết nó quy định gì.

```
Traditional East Asian ink wash painting (sumi-e / shuimo), monochrome black ink only, wet brush on absorbent paper: soft bleeding edges, visible dry-brush streaks, tonal range from deep black to pale grey wash. Expressive and minimal, large areas left empty. Background is pure flat white (#FFFFFF) with no paper texture, no tint, no vignette, no shadow. One subject only, fully inside the frame with a clear white margin on every side. No text, no calligraphy, no red seal, no signature, no border, no frame, no people, no animals, no boats, no buildings.
```

## 1. Trăng (hình vòng tròn) — ảnh vuông 1:1

```
Traditional East Asian ink wash painting (sumi-e / shuimo), monochrome black ink only, wet brush on absorbent paper: soft bleeding edges, visible dry-brush streaks, tonal range from deep black to pale grey wash. Expressive and minimal, large areas left empty. Background is pure flat white (#FFFFFF) with no paper texture, no tint, no vignette, no shadow. One subject only, fully inside the frame with a clear white margin on every side. No text, no calligraphy, no red seal, no signature, no border, no frame, no people, no animals, no boats, no buildings.

Subject: a full moon, a single perfect circle centred in the image, filling about 70% of the width. The disc is a pale grey wash with a few darker wet blotches for its seas, and a slightly darker soft rim. Nothing else in the image: no clouds, no stars, no branches. Square image, 1:1.
```

## 2. Sông (hình chữ S) — ảnh ngang 16:9

Sông phải **thẳng** và chạy ngang: game sẽ tự uốn nó theo nét chữ S của người chơi.

```
Traditional East Asian ink wash painting (sumi-e / shuimo), monochrome black ink only, wet brush on absorbent paper: soft bleeding edges, visible dry-brush streaks, tonal range from deep black to pale grey wash. Expressive and minimal, large areas left empty. Background is pure flat white (#FFFFFF) with no paper texture, no tint, no vignette, no shadow. One subject only, fully inside the frame with a clear white margin on every side. No text, no calligraphy, no red seal, no signature, no border, no frame, no people, no animals, no boats, no buildings.

Subject: a river seen from a high angle, running perfectly straight and horizontal from the left edge of the subject to the right, as one band across the middle of the image, the same width along its whole length (about one fifth of the image height). The water is pale grey wash with long horizontal flow lines; both banks are darker broken ink with a few rocks and reed tufts. The river does not bend, does not fork and does not narrow with distance. White above and below. Wide image, 16:9.
```

## 3. Dãy núi (hình đường ngang lượn sóng) — ảnh ngang 16:9

Chân núi phải tan vào trắng: game đặt đường sống núi lên nét của người chơi, phần dưới tự mờ đi.

```
Traditional East Asian ink wash painting (sumi-e / shuimo), monochrome black ink only, wet brush on absorbent paper: soft bleeding edges, visible dry-brush streaks, tonal range from deep black to pale grey wash. Expressive and minimal, large areas left empty. Background is pure flat white (#FFFFFF) with no paper texture, no tint, no vignette, no shadow. One subject only, fully inside the frame with a clear white margin on every side. No text, no calligraphy, no red seal, no signature, no border, no frame, no people, no animals, no boats, no buildings.

Subject: a single mountain range seen from the side, spanning the image from left to right. The ridge line along the top is the darkest, sharpest part; the slopes below fade steadily into pale wash and dissolve completely into white mist before reaching the bottom of the image, so there is no ground line and no foreground. Three to five peaks of different heights. Empty white sky above. Wide image, 16:9.
```

## 4. Thác nước (nét sổ thẳng) — ảnh dọc 9:16

```
Traditional East Asian ink wash painting (sumi-e / shuimo), monochrome black ink only, wet brush on absorbent paper: soft bleeding edges, visible dry-brush streaks, tonal range from deep black to pale grey wash. Expressive and minimal, large areas left empty. Background is pure flat white (#FFFFFF) with no paper texture, no tint, no vignette, no shadow. One subject only, fully inside the frame with a clear white margin on every side. No text, no calligraphy, no red seal, no signature, no border, no frame, no people, no animals, no boats, no buildings.

Subject: a tall narrow waterfall dropping perfectly straight down the centre of the image from top to bottom, the same width along its whole height (about one fifth of the image width). The falling water is left as white paper with a few thin vertical grey streaks; it is shaped by dark wet rock on its left and right sides. A soft cloud of spray at the bottom fading to white. No pool, no river, no trees. Tall image, 9:16.
```

## 5. Cây tùng (nét sổ thẳng, phương án hai) — ảnh dọc 9:16

```
Traditional East Asian ink wash painting (sumi-e / shuimo), monochrome black ink only, wet brush on absorbent paper: soft bleeding edges, visible dry-brush streaks, tonal range from deep black to pale grey wash. Expressive and minimal, large areas left empty. Background is pure flat white (#FFFFFF) with no paper texture, no tint, no vignette, no shadow. One subject only, fully inside the frame with a clear white margin on every side. No text, no calligraphy, no red seal, no signature, no border, no frame, no people, no animals, no boats, no buildings.

Subject: one old pine tree, its trunk rising straight up the centre of the image from bottom to top, rough bark in dry-brush strokes. Short horizontal branches to both sides carrying flat clusters of needles in dark ink. The base of the trunk fades into white with no ground, no rocks and no roots shown. Tall image, 9:16.
```

## 6. Dải mây (hình vô cực) — ảnh ngang 16:9

```
Traditional East Asian ink wash painting (sumi-e / shuimo), monochrome black ink only, wet brush on absorbent paper: soft bleeding edges, visible dry-brush streaks, tonal range from deep black to pale grey wash. Expressive and minimal, large areas left empty. Background is pure flat white (#FFFFFF) with no paper texture, no tint, no vignette, no shadow. One subject only, fully inside the frame with a clear white margin on every side. No text, no calligraphy, no red seal, no signature, no border, no frame, no people, no animals, no boats, no buildings.

Subject: one long bank of rolling clouds running straight and horizontal across the middle of the image, the same thickness along its whole length (about one quarter of the image height). Built from soft rounded billows in very pale grey wash with slightly darker undersides, edges melting into white. No sky colour, no sun, no moon, no mountains. Wide image, 16:9.
```

## 7. Xoáy mây (đặt vào hai vòng của hình vô cực) — ảnh vuông 1:1

```
Traditional East Asian ink wash painting (sumi-e / shuimo), monochrome black ink only, wet brush on absorbent paper: soft bleeding edges, visible dry-brush streaks, tonal range from deep black to pale grey wash. Expressive and minimal, large areas left empty. Background is pure flat white (#FFFFFF) with no paper texture, no tint, no vignette, no shadow. One subject only, fully inside the frame with a clear white margin on every side. No text, no calligraphy, no red seal, no signature, no border, no frame, no people, no animals, no boats, no buildings.

Subject: a single cloud curling into a spiral, like the cloud scroll motif of classical East Asian painting, centred and filling about 70% of the image. Pale grey wash, soft billowing outer edge, the spiral line drawn in slightly darker wet ink. Nothing else in the image. Square image, 1:1.
```

## Bản cho Midjourney

Midjourney hợp lời nhắc ngắn và dùng tham số ở cuối, nên dùng 7 dòng dưới đây thay cho các khối dài ở trên. Dán vào ô Imagine trên midjourney.com hoặc sau `/imagine` trên Discord.

- `--style raw`: bớt tự tô vẽ thêm. `--no ...`: chặn triện, chữ, vân giấy.
- Giữ một lối vẽ cho cả kho: sau khi ưng bức trăng, lấy đường dẫn ảnh đó và thêm `--sref <đường dẫn>` vào cuối mọi lời nhắc còn lại.
- Tải ảnh đã phóng to (Upscale), lưu PNG đúng tên như mục "Cách làm".

Trăng:
```
sumi-e ink wash painting of a full moon, single perfect circle centred, pale grey wash disc with a few darker wet blotches, soft darker rim, monochrome black ink, wet brush bleeding edges, minimal, isolated on pure flat white background, wide empty margin --ar 1:1 --style raw --no text, calligraphy, red seal, signature, border, paper texture, clouds, stars, branches, color
```

Sông:
```
sumi-e ink wash painting of a river seen from above, one perfectly straight horizontal band across the middle, same width along its whole length, pale grey water with long flow lines, darker broken ink banks with small rocks and reeds, monochrome black ink, minimal, isolated on pure flat white background --ar 16:9 --style raw --no text, calligraphy, red seal, signature, border, paper texture, boats, people, bridge, bend, curve, perspective, color
```

Dãy núi:
```
sumi-e ink wash painting of a single mountain range in side view, three to five peaks, dark sharp ridge line on top, slopes fading downward into pale wash and dissolving completely into white mist, no ground line, empty white sky, monochrome black ink, minimal, isolated on pure flat white background --ar 16:9 --style raw --no text, calligraphy, red seal, signature, border, paper texture, trees, houses, people, birds, sun, moon, foreground, color
```

Thác nước:
```
sumi-e ink wash painting of a tall narrow waterfall falling perfectly straight down the centre, same width top to bottom, water left as white paper with thin grey streaks, dark wet rock on both sides, soft spray fading to white at the bottom, monochrome black ink, minimal, isolated on pure flat white background --ar 9:16 --style raw --no text, calligraphy, red seal, signature, border, paper texture, pool, river, trees, people, color
```

Cây tùng:
```
sumi-e ink wash painting of one old pine tree, straight vertical trunk in the centre from bottom to top, rough dry-brush bark, short horizontal branches with flat dark needle clusters, base of trunk fading into white, monochrome black ink, minimal, isolated on pure flat white background --ar 9:16 --style raw --no text, calligraphy, red seal, signature, border, paper texture, ground, rocks, mountains, birds, color
```

Dải mây:
```
sumi-e ink wash painting of one long bank of rolling clouds, a straight horizontal strip across the middle, same thickness along its whole length, soft rounded billows in very pale grey wash with slightly darker undersides, edges melting into white, monochrome black ink, minimal, isolated on pure flat white background --ar 16:9 --style raw --no text, calligraphy, red seal, signature, border, paper texture, sun, moon, mountains, birds, sky color
```

Xoáy mây:
```
sumi-e ink wash painting of a single cloud curling into a spiral, classical East Asian cloud scroll motif, centred, pale grey wash with the spiral line in darker wet ink, soft billowing outer edge, monochrome black ink, minimal, isolated on pure flat white background, wide empty margin --ar 1:1 --style raw --no text, calligraphy, red seal, signature, border, paper texture, dragon, sun, moon, color
```

## Nếu mô hình không nghe lời

- Vẫn ra nền ngả màu: thêm `The background must be exactly #FFFFFF, like a scanned drawing with the paper removed.`
- Vẫn thêm triện hay chữ: thêm `Absolutely no red marks and no writing anywhere.`
- Sông hoặc mây vẫn uốn cong: thêm `Draw it as a straight ruler-flat strip; it will be bent later by software.`
- Ra ảnh chụp hoặc tranh 3D: thêm `Hand-painted with brush and ink, flat, not a photograph, not 3D.`

## River sheets (11-19) -> web/assets/inklines/"<Source> F|G|H.png", Muse first

Shared tail for all three: `Pure black sumi ink on flat pure white background, no paper texture, no colour, no shading of the background, no frame, no text, no seal. Each piece separate, wide white gaps between pieces, nothing touching or overlapping. Traditional Chinese shan shui brushwork, not Western watercolour, no blooms, no cauliflower edges.`

F, river banks (cut by level(), upper edge = waterline):
`A brush practice sheet, landscape 16:9. Eight long horizontal brush strokes stacked top to bottom, each spanning almost the full width, evenly spaced. Each stroke is the bank of a river as painted in shan shui: its UPPER edge is a crisp dark line (the waterline), nearly level with slight unevenness; BELOW that edge the ink breaks down into dry-brush drag, short downward flicks and a few small dark dots of pebbles, fading out within a short distance. The weight varies along each stroke: pressed dark in places, thin and broken in others, with one or two short gaps. Strokes differ from each other: some heavy and rocky, some light and sandy.` + tail

G, current lines (cut by level()):
`A brush practice sheet, landscape 16:9. Ten very thin long horizontal ink lines stacked top to bottom, each spanning almost the full width, evenly spaced. Each is a line of flowing water drawn with the tip of a fine brush in one pass: hair-thin, gently wavering, thicker where the brush pressed and vanishing where it lifted, breaking off and resuming two or three times, pale to mid grey ink. Some lines are a pair of two close parallel hairlines. No waves, no curls, no dots.` + tail

H, loose pieces (cut by loose(): long low = ripple strokes, compact = rocks):
`A brush practice sheet, landscape 16:9. About twenty-four small separate ink pieces scattered evenly. Half are riverside rocks in shan shui style: angular outline in a dark dry stroke, top left white, a little grey wash at the base, single rocks and groups of two or three, different sizes. Half are short water ripples: two to four thin shallow arcs lying side by side like a small flat wave or the wake around a stone, hair-thin, grey.` + tail

## Lake sheets (11-19) -> web/assets/inklines/"<Source> I|J.png", Muse first. Same shared tail as the river sheets.

I, lake shore (cut by level(), upper edge = waterline):
`A brush practice sheet, landscape 16:9. Eight long horizontal brush strokes stacked top to bottom, each spanning almost the full width, evenly spaced. Each stroke is the shore of a still lake as painted in shan shui: its UPPER edge is a calm, almost perfectly level dark line (the waterline), drawn slowly with a wet brush; BELOW it a low flat strip of shore: soft dry-brush drag lying level, a few short level dashes, thinning out to nothing within a short distance. Quiet and flat, no flicks pointing down, no pebbles, no dots, no rocks. The weight varies along each stroke: dark and full in places, pale and almost vanishing in others, with one or two gaps. The first four strokes are heavy and dark (a near shore), the last four thin and pale grey (a far shore lost in mist).` + tail

J, still water (cut by level()):
`A brush practice sheet, landscape 16:9. Twelve rows stacked top to bottom, evenly spaced, each row spanning almost the full width. Each row is the surface of still water drawn with the very tip of a fine brush: one perfectly level hairline, as thin as a single hair, broken into four to seven dashes of different lengths with small gaps between them; every dash begins and ends in a fine point. Pale grey ink, some dashes a little darker. Perfectly level, no waves, no wavering, no curls, no dots, no double lines.` + tail

K, lake and river shore growth (cut by tufts(): upper rows = reeds `_w`, bottom row = rocks `_s`; bottom of a piece = the ground):
`A brush practice sheet, landscape 16:9. About twenty-four small separate ink pieces in three rows, evenly spaced. Top two rows: clumps of lakeside reeds and water grass in shan shui style, each clump five to twelve thin blades rising from one flat base, drawn in single quick upward flicks of a fine brush, each blade thick at the root and ending in a hair-thin point, some blades bent over, a few with a small dark seed head; clumps differ in height and width, some dark, some pale grey. Bottom row: low shore rocks, each drawn with a few broken dry-brush strokes, no continuous outline, top left white, a touch of grey wash at the base, flat bottom. Every piece sits on a level base line.` + tail

L, leaping fish and splash rings (cut by fish(): upper row = fish `_x`, head up and to the right; lower row = rings `_o`):
`A brush practice sheet, landscape 16:9. Two rows, evenly spaced. Top row: eight small fish in shan shui ink style, each seen from the side, facing right, body level, drawn in two or three quick wet strokes: a dark tapering body, a forked tail flicked out, one or two tiny fins, no eye detail, no scales, no outline; bodies slightly curved in different ways, as if leaping; some dark, some mid grey. Bottom row: eight splash rings on still water, each two or three thin broken concentric ellipses lying flat, much wider than tall, hair-thin grey lines with gaps, some with two or three tiny flicked droplets above the centre.` + tail

## Tree and grass sheets (11-19) -> web/assets/inklines/"<Source> M|N|O.png", Muse first. Same shared tail as the river sheets.

M, trunks and branches (cut by trunks(): long ones = trunks `_t`, root left, straightened by their middle line; short ones in the lower part = branches `_y`, base left):
`A brush practice sheet, landscape 16:9. Top half: six long horizontal brush strokes stacked, each spanning almost the full width: tree trunks in shan shui style laid on their side, root at the left and tip at the right, thick at the root and tapering steadily to a thin tip, drawn with a dry brush so the ink breaks into rough bark texture, a few dark knots, edges uneven; some gnarled and dark like old pine, some smoother and paler. Bottom half: twelve short separate branch strokes in two rows, each a single tapering dry-brush stroke from thick to a fine point, slightly crooked, some with one small fork. No leaves, no needles.`

N, foliage (cut by rowsheet(): rows top to bottom = needle fans `_n`, pine boughs `_p`, leaf-dot clusters `_q`). Muse's came out as one bough and one dot cluster copied eight times, fans ruled like vector lines: regenerate for variety if it shows.
`A brush practice sheet, landscape 16:9. Three rows of eight small separate ink pieces, evenly spaced. Top row: pine needle clusters in shan shui style, each a flat fan of many fine straight needles radiating from one point like a half wheel, dark ink. Middle row: layered pine boughs, each a low wide cloud-shaped mass of several needle fans side by side, flat underneath, dark at the bottom and paler on top. Bottom row: leaf-dot clusters for broadleaf trees, each a loose group of fifteen to forty small wet dabs of the brush tip, some dabs horizontal dashes, some round dots, dark and mid grey mixed, denser in the middle and scattered at the edge. No trunks, no branches.`

N v2 (11-19, same layout so rowsheet() cuts it unchanged; v1 gave copies, this one spells out the differences per piece):
`A brush practice sheet, landscape 16:9. Three rows of eight small separate ink pieces, evenly spaced. EVERY PIECE IS DIFFERENT FROM ALL THE OTHERS: no piece is a copy, a mirror image or a resized version of another; each is painted by hand, separately. Top row: eight pine needle clusters in shan shui style, each a flat fan of fine needles radiating from one point, painted with quick hand strokes of uneven length and weight, a few needles crossing, some fans a full half wheel, some a narrow wedge, some leaning to one side, some sparse with gaps, dark ink. Middle row: eight layered pine boughs, each a low wide mass built of needle fans, flat underneath, dark at the bottom and paler on top; they differ clearly in silhouette: one of two fans, one of three, one of five or six; one long and thin, one short and humped, one lopsided with its high point at the left, one with its high point at the right, one in two tiers, one ragged and broken with white gaps, one with a stray fan standing off its end. Bottom row: eight leaf-dot clusters for broadleaf trees, each a loose group of small wet dabs of the brush tip, dark and mid grey mixed; they differ clearly: one small and dense of about fifteen dabs, one large and airy of about forty, one wide and flat, one tall, one of round dots only, one of short level dashes only, one of slanting dashes, one split into two clumps; outlines irregular, never a neat circle. No trunks, no branches.`

O, grass (cut by rowsheet(): rows = tufts `_u`, low patches `_v`, small plants `_z`; bottom of a piece = the ground):
`A brush practice sheet, landscape 16:9. Three rows of eight small separate ink pieces, evenly spaced, every piece sitting on a level base line. Top row: short grass tufts in shan shui style, each four to nine short blades flicked upward from one point, fanning out, each blade ending in a hair-thin tip. Middle row: wider low patches of grass, several tufts side by side with a few level dashes of ground beneath. Bottom row: small wild plants and low shrubs, a few thin stems with tiny leaf dabs, some with a small dark flower dot. Much shorter and softer than reeds, some dark, some pale grey.`

## Close branch sheets (11-19) -> web/assets/inklines/"<Source> P|Q.png", Muse first. For the bird-and-flower branch (zhezhi): key 4, stroke flown level and long. Cutters not written yet.

P, close branches (ink only, shared tail of the river sheets; long ones = main branch, base left; short ones = twigs, base left):
`A brush practice sheet, landscape 16:9. Top half: five long horizontal brush strokes stacked, each spanning almost the full width: old plum tree branches seen close up, as in Chinese bird-and-flower painting (xieyi style), laid level, base at the left and tip at the right. Each is thick and heavy at the base and thins toward the tip, angular and crooked with sharp elbows, painted with a dry brush dragged fast so the ink breaks into streaks of white (flying white), with dark wet knots, broken stubs of snapped side branches and a few moss dots. Every branch different: one stout and almost straight, one with two sharp elbows, one that dips and rises, one thin and wiry, one very gnarled. Bottom half: fourteen short separate twigs in two rows, each a single quick stroke from a thicker base to a needle-fine tip, straight or with one sharp bend, some with one small fork, some with two or three tiny bud knobs. Every twig different. No flowers, no leaves.` + tail

Q, plum blossoms (COLOUR sheet, own tail; cut by "differs from white", colours kept as painted; rows = open flowers, side views and buds, loose petals):
`A brush practice sheet, landscape 16:9. Three rows of small separate pieces, evenly spaced, in the style of Chinese bird-and-flower painting (xieyi, loose brush). EVERY PIECE IS DIFFERENT FROM ALL THE OTHERS, none a copy or a mirror image. Top row: eight open plum blossoms seen from the front or three-quarter view, each five round petals painted as single wet dabs of red (cinnabar red to deep rose, darker at the petal edge and paler toward the centre where the water pooled), a few fine dark ink stamens with tiny dots at the centre; sizes differ, some petals overlapping, one flower with a petal missing. Middle row: ten pieces: blossoms seen from the side and half open, and round buds, single or in pairs, each sitting on a small dark ink calyx of two or three dots. Bottom row: twelve single fallen petals and tiny buds, pale rose to red, different shapes. Colours muted and traditional, mineral pigment on rice paper, not bright, not pink candy, no gradients of digital airbrush. Flat pure white background, no paper texture, no shading of the background, no frame, no text, no seal. Each piece separate, wide white gaps between pieces, nothing touching or overlapping. No branches, no leaves, no outline drawn round the petals.`

## More tree sheets (11-19) -> web/assets/inklines/"<Source> R|S|T|U.png", Muse first. Ink only, shared tail of the river sheets. Cutters and tree kinds not written yet.

R, leaf conventions of the painting manuals (three rows of eight, rowsheet() layout: jiezi strokes, outlined leaves, level Mi dots):
`A brush practice sheet, landscape 16:9. Three rows of eight small separate ink pieces, evenly spaced. EVERY PIECE IS DIFFERENT FROM ALL THE OTHERS, none a copy or a mirror image. These are the classical foliage patterns of Chinese shan shui painting manuals. Top row: clusters of drooping leaf strokes (jiezi dots): each cluster built of many small groups of three or four short pointed strokes fanning downward from one point, like hanging leaves, dark ink, groups overlapping, outline of the cluster irregular; clusters differ in size and density. Middle row: clusters of outlined leaves (jiaye): each a bunch of twelve to thirty small leaves drawn in fine line only, empty inside, some clusters of round leaves, some of pointed three-lobed maple leaves, some of long narrow leaves, overlapping loosely. Bottom row: clusters of level dots (Mi dots): each a low wide mass of short fat horizontal dabs laid wet in layers, pale grey underneath and dark on top, denser in the middle, like the crown of a distant tree in rain. No trunks, no branches.` + tail

S, willow (pieces hang: top of a piece = where it is tied to the branch):
`A brush practice sheet, landscape 16:9. Two rows of seven separate ink pieces, evenly spaced, every piece hanging from a level line at its top. Each piece is a curtain of weeping willow twigs in shan shui style: six to fifteen very long hair-thin lines falling almost straight down from the top, each drawn in one stroke of a fine brush tip, slightly curved as if moved by a light wind, all leaning the same way within one piece, ending in fine points at different lengths; along the lower two thirds of each line tiny short leaf flicks on both sides, sparse. EVERY PIECE DIFFERENT: some narrow of few strands, some wide and full, some long, some short, some blown strongly to one side, some dark, some pale grey as if far away. Top row leafy (summer), bottom row almost bare lines with very few flicks (early spring). No trunks, no thick branches.` + tail

T, bamboo (top half: stalks laid level, root left, cut like trunks; bottom half: leaf groups, upper end = where they join the twig):
`A brush practice sheet, landscape 16:9. Top half: six long horizontal brush strokes stacked, each spanning almost the full width: bamboo stalks in Chinese ink style laid on their side, root at the left and tip at the right, each made of separate segments painted one push of a flat brush each, with a small white gap and a thin dark joint line at every node, segments shorter near the root and longer in the middle, paler in the centre of the stroke and darker at its edges; stalks differ in thickness and tone, two thick and dark, two medium, two thin and pale grey; slightly bowed, never ruler-straight. Bottom half: sixteen separate groups of bamboo leaves in two rows: each group three to seven leaves springing from one point and pointing downward and outward, each leaf one pressed stroke, broad in the middle and ending in a sharp point, dark ink with a few paler leaves behind; EVERY GROUP DIFFERENT in number of leaves, spread and direction, some blown to one side.` + tail

U, more trunks and bare winter crowns (top half: trunks laid level, root left, cut by trunks(); bottom half: bare crowns, base at the bottom):
`A brush practice sheet, landscape 16:9. Top half: six long horizontal brush strokes stacked, each spanning almost the full width: tree trunks in shan shui style laid on their side, root at the left and tip at the right, tapering to a thin tip, EVERY TRUNK A DIFFERENT KIND: one old pine with scaly bark drawn as rows of small dry arcs; one twisted cypress with long spiralling dry-brush grain; one pale smooth trunk drawn as two thin outline strokes with white between and short dark level marks, like birch; one thick hollow old trunk with a dark hole and broken stubs; one willow trunk, rough, swollen and knotty; one slender young tree in a single wet dark stroke. Edges uneven, dry brush breaking into white. Bottom half: ten separate bare tree crowns in two rows, each standing on a short stem at the bottom: leafless winter branching in fine tapering lines, forking again and again to hair-thin tips; half of them with twig ends hooked downward like crab claws, half with twig ends pointing upward like deer antlers; EVERY CROWN DIFFERENT in width, height and lean. No leaves, no needles.` + tail

N v4 from Muse (11-19) in use: 8 fans, 4 boughs (5th on dropped: thatch-roof cones, stacked smears), 9 dot clusters. Cut as ink islands (rowsheet blob=).
Seen 11-19, not wired yet: P good (real dry brush). Q usable (muted red; drips of black dots under the buds to cut off). R: jiezi row good, outlined-leaf row is a ruled pen line (not brush: skip or regenerate), Mi-dot row good but eight near copies. S: hair lines pen-like, usable small; a ruled line across the top to cut off. T good; stalks are one stalk at six weights.
U v2 from Muse REJECTED (Yang: not ink painting). It is pen-and-ink illustration: contour lines, hatching, a scale pattern. Cause: the prompt named things to draw ("rows of small arcs", "two outline strokes", "fine lines"), so it drew them with a pen. U v3 below names the brush's act instead.

U v3:
`A brush practice sheet, landscape 16:9. Top half: six long horizontal marks stacked, each spanning almost the full width: tree trunks in Chinese shan shui ink painting laid on their side, root at the left, tip at the right. EACH TRUNK IS ONE SINGLE PASS OF A WIDE SOFT BRUSH loaded with ink, pressed hard at the root and lifted gradually to a thin tip; where the brush ran dry the ink breaks into ragged streaks with white paper showing through (flying white); a few darker wet blots where the brush paused, a few dry dabs of the brush tip added on top for knots and moss. No outlines, no contour lines, no hatching, no drawn bark pattern, no pen or marker line anywhere: only the trace of the brush itself. The six differ by how the brush moved: one wet, dark and smooth; one very dry and streaky; one twisting, the stroke wavering from side to side; one made of two overlapping passes, pale under dark; one with broken stubs where short side strokes were flicked out; one slender and pale grey. Bottom half: ten separate bare winter tree crowns in two rows, each standing on a short stem: every branch a single stroke of a pointed brush, thick where it leaves the stem and tapering to a hair, pressure visibly changing along it, slightly dry, forking two or three times only; half with twig ends hooked downward (crab-claw), half pointing upward (deer-antler). Sparse, loose, quick, not detailed, not symmetrical, every crown different.` + tail

U v3 from Muse (11-19) kept: six trunks are real brush passes (wet, dry streaky, wavering, two-pass, stubbed, pale). Bare crowns crude (stubby, crab-claw ones read as claws): not to be used; a winter tree = branches grown by code, left bare.

## Sheet V: single willow withes (11-19)
Why: withes grown by code = "quá sạch và sleek" (Yang). Sheet S curtains unusable (stamped whole = combs). Want single withes, lying level, base left, to lay in slices along a grown path (cutter: `trunks`, as M/P/U).

`A brush practice sheet, landscape 16:9. Ten long horizontal marks stacked, each spanning almost the full width, wide white gaps between them: single hanging twigs of a weeping willow in Chinese ink painting, each laid on its side, the end that grows from the branch at the left, the free tip at the right. EACH TWIG IS ONE SINGLE CONTINUOUS PASS OF A FINE POINTED BRUSH, set down with a little pressure at the left and drawn fast to the right, thinning to a hair at the tip; the hand's pressure wavers so the line swells and thins along its way; where the brush ran dry the line breaks into short gaps and grains. Almost straight, only slightly wavering, never ruler-straight. Along the right two thirds of each twig, small narrow willow leaves to either side, each leaf one quick press-and-lift of the brush tip, fat where it was set down and pointed where it left, slanting toward the tip, uneven in size, spacing and darkness, a few overlapping, a few missing. The ten differ: three thick and dark with many leaves, three thin with few leaves, two pale grey as if far away, two nearly bare with only buds. No outlines, no pen or marker line, no even spacing, nothing mechanical.` + tail
