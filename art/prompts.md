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
