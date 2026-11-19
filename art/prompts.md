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
