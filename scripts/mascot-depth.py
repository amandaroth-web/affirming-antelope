#!/usr/bin/env python3
"""Depth + eyelid textures for the 2.5D hero mascot (wave pose).

mascot-wave-depth.png : R = depth, 0 far -> 1 near (blurred, no hard steps)
mascot-wave-lids.png  : R = lid mask, G = top->bottom gradient inside each eye
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public/brand-mascot-wave-cartoon.png"
W, H = 674, 978


def poly(points):
    im = Image.new("L", (W, H), 0)
    ImageDraw.Draw(im).polygon(points, fill=255)
    return np.array(im) > 0


def ellipse(box):
    im = Image.new("L", (W, H), 0)
    ImageDraw.Draw(im).ellipse(box, fill=255)
    return np.array(im) > 0


def main():
    src = np.array(Image.open(SRC).convert("RGBA"))
    opaque = src[:, :, 3] > 16

    hoof = poly([(30, 184), (78, 168), (122, 182), (128, 218), (108, 252), (68, 262), (36, 240), (28, 210)])
    fore = poly([(42, 248), (118, 228), (140, 268), (132, 355), (118, 418), (78, 432), (52, 390), (38, 310)])
    upper = poly([(58, 410), (125, 395), (175, 445), (225, 520), (228, 575), (175, 595), (118, 555), (72, 490), (54, 440)])
    head = poly([(175, 90), (250, 40), (340, 22), (430, 40), (510, 95), (545, 200), (540, 340), (510, 470), (450, 560), (340, 590), (230, 565), (155, 480), (130, 340), (140, 200)])
    ear_l = poly([(155, 70), (210, 40), (255, 90), (250, 180), (215, 250), (160, 240), (130, 170), (135, 100)])
    ear_r = poly([(430, 55), (490, 35), (545, 80), (570, 150), (545, 230), (490, 255), (440, 210), (425, 120)])
    scarf = poly([(195, 555), (255, 542), (340, 538), (420, 548), (475, 575), (508, 608), (492, 675), (430, 705), (365, 665), (295, 655), (225, 675), (180, 645), (178, 590)])
    muzzle = ellipse((215, 440, 470, 600))
    EYE_L, EYE_R = (172, 323, 264, 455), (368, 326, 480, 462)
    # iris extents measured from the dark-brown ring pixels, +1px
    PUPIL_L, PUPIL_R = (192, 359, 263, 453), (371, 367, 446, 462)
    eye_l = ellipse(EYE_L)
    eye_r = ellipse(EYE_R)
    yy = np.arange(H)[:, None]
    horns = (yy < 175) & head

    depth = np.full((H, W), 0.30, dtype=np.float32)  # body / legs
    depth[ear_l | ear_r] = 0.42
    depth[head] = 0.58
    depth[horns] = 0.40
    depth[muzzle] = 0.70
    depth[eye_l | eye_r] = 0.72
    depth[scarf] = 0.50
    depth[upper] = 0.62
    depth[fore] = 0.76
    depth[hoof] = 0.90

    # outside silhouette: neutral so edges don't smear
    depth[~opaque] = 0.5
    img = Image.fromarray((depth * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(7))
    img.save(ROOT / "public/mascot-wave-depth.png")

    # Eye texture: R = repaintable interior (sclera + pupil, never the drawn
    # navy lid/outline), G = curved top->bottom gradient for the blink,
    # B = pupil: the dark-brown iris ring plus everything it encloses.
    rgb = src[:, :, :3].astype(int)
    lum = rgb.mean(axis=2)
    white = (rgb.min(axis=2) > 225) & opaque
    dark = (lum < 120) & opaque
    brown = (rgb[:, :, 0] > rgb[:, :, 2] + 30) & (lum < 130) & opaque

    def dilate(mask, size):
        return np.array(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(size))) > 0

    def fill_holes(mask, box):
        x0, y0, x1, y1 = box
        pad = np.zeros((H, W), dtype=np.uint8)
        pad[y0 - 2 : y1 + 3, x0 - 2 : x1 + 3] = 128
        pad[mask] = 0
        ff = Image.fromarray(pad).copy()  # fromarray is read-only
        ImageDraw.floodfill(ff, (x0 - 2, y0 - 2), 255, thresh=0)
        outside = np.array(ff) == 255
        return mask | ((pad > 0) & ~outside)

    def component(mask, seed):
        im = Image.fromarray(np.where(mask, 128, 0).astype(np.uint8)).copy()
        ImageDraw.floodfill(im, seed, 255, thresh=0)
        return np.array(im) == 255

    lids = np.zeros((H, W, 3), dtype=np.uint8)
    pupils = np.zeros((H, W), dtype=bool)
    erases = np.zeros((H, W), dtype=bool)
    discs = np.zeros((H, W), dtype=bool)
    # The hand-fitted eye ellipse is only a search window; the iris ring and the
    # sclera both poke slightly past it, so search a padded window and keep the
    # connected blob around each pupil centre.
    for eye_box, centre in ((EYE_L, (230, 405)), (EYE_R, (412, 415))):
        x0, y0, x1, y1 = eye_box
        window = ellipse((x0 - 8, y0 - 8, x1 + 8, y1 + 8))
        eye = window
        ring = window & brown
        disc = component(fill_holes(ring, (x0 - 8, y0 - 8, x1 + 8, y1 + 8)), centre)
        # one pixel of anti-aliased rim, but never into the drawn navy
        # Anti-aliased rim around the iris is warm (brown/white blends); the
        # outline's rim is cool grey. Only warm pixels may travel with the pupil.
        warm = (rgb[:, :, 0] > rgb[:, :, 2] + 12) & ~dark
        pure_white = (rgb.min(axis=2) > 245) & opaque
        pupil = disc | (dilate(disc, 3) & warm & ~pure_white)
        # Erase footprint is wider so no ghost of the iris edge stays behind.
        erase = disc | (dilate(disc, 5) & ~dark)
        pupils |= pupil
        erases |= erase
        discs |= disc
        sclera = eye & white
        interior = (sclera | dilate(sclera, 3)) & ~dark | pupil
        x0, y0, x1, y1 = eye_box
        cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
        xs = np.arange(W)[None, :]
        rx2, ry2 = rx + 8, ry + 8
        half = ry2 * np.sqrt(np.clip(1 - ((xs - cx) / rx2) ** 2, 0, 1)) + 1e-3
        grad = np.clip((yy - (cy - half)) / (2 * half), 4 / 255, 1)
        lids[interior, 0] = 255
        lids[interior, 1] = (np.broadcast_to(grad, (H, W))[interior] * 255).astype(np.uint8)
        lids[pupil, 2] = 255

    protect = dark & ~pupils
    r = np.array(Image.fromarray(lids[:, :, 0]).filter(ImageFilter.GaussianBlur(0.7))).astype(float)
    b = np.array(Image.fromarray(lids[:, :, 2]).filter(ImageFilter.GaussianBlur(0.7))).astype(float)
    e = np.array(Image.fromarray((erases * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))).astype(float)
    # Soft edges outside the iris, but fully on across the iris itself so the
    # rest pose is pixel-identical and no half-erased ring survives.
    r[discs] = 255
    b[discs] = 255
    e[discs] = 255
    r[protect] = 0
    b[protect] = 0
    e[protect] = 0
    out = Image.merge(
        "RGB",
        (
            Image.fromarray(r.astype(np.uint8)),
            Image.fromarray(lids[:, :, 1]),
            Image.fromarray(b.astype(np.uint8)),
        ),
    )
    print("pupil px", int(pupils.sum()))
    out.save(ROOT / "public/mascot-wave-lids.png")

    # Face texture: R = open-mouth interior, G = brows, B = pupil erase footprint.
    # Mouth: everything inside the box that isn't muzzle cream.
    navy = (rgb.sum(axis=2) < 300) & (rgb[:, :, 2] > rgb[:, :, 0] + 8) & opaque
    # Mouth: the connected non-cream blob under the tongue, so the chin outline
    # and scarf just below never get pulled in.
    cream = np.array([254, 237, 207])
    MOUTH = (236, 486, 390, 576)  # search window only
    not_cream = np.abs(rgb - cream).sum(axis=2) > 60
    win = np.zeros((H, W), dtype=np.uint8)
    win[MOUTH[1]:MOUTH[3], MOUTH[0]:MOUTH[2]] = 128
    win[~(not_cream & opaque)] = 0
    flood = Image.fromarray(win).copy()  # fromarray is read-only; floodfill needs a copy
    ImageDraw.floodfill(flood, (312, 540), 255, thresh=0)
    blob = np.array(flood) == 255
    mouth = Image.fromarray((blob * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
    ys, xs = np.where(blob)
    print("mouth blob bbox x", xs.min(), xs.max(), "y", ys.min(), ys.max())
    # Brows: navy strokes inside two boxes that only contain fur otherwise.
    brows = np.zeros((H, W), dtype=bool)
    for x0, y0, x1, y1 in ((176, 250, 256, 298), (388, 252, 478, 304)):
        brows[y0:y1, x0:x1] = navy[y0:y1, x0:x1]
    brow_img = Image.fromarray((brows * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
    face = Image.merge(
        "RGB",
        (
            mouth.filter(ImageFilter.GaussianBlur(0.8)),
            brow_img.filter(ImageFilter.GaussianBlur(0.8)),
            Image.fromarray(e.astype(np.uint8)),  # pupil erase footprint
        ),
    )
    face.save(ROOT / "public/mascot-wave-face.png")
    print("mouth px", int(np.array(mouth).astype(bool).sum()), "brow px", int(brows.sum()))
    build_arm(src)
    print("wrote depth + lids + face + arm")


# Image-space rig for the raised arm. Shared with mascot-three.tsx.
ARM_SHOULDER = (205, 615)
ARM_WRIST = (120, 490)


def build_arm(src):
    """mascot-wave-arm.png: R = arm sticker mask (hard), G = shoulder bone
    weight, B = wrist bone weight.

    The raised arm is drawn in front of the cheek, and only ever swings *inward*
    (toward the face), so whatever it uncovers is page background. The base
    plane erases the sticker footprint; a second mesh draws the same pixels and
    bends them in the vertex shader with these weights.
    """
    rgb = src[:, :, :3].astype(int)
    alpha = src[:, :, 3]
    lum = rgb.mean(2)
    opaque = alpha > 128
    sat = rgb.max(2) - rgb.min(2)
    navy = opaque & (lum < 120) & (rgb[:, :, 2] > rgb[:, :, 0] - 10)
    cream = opaque & (rgb[:, :, 0] > 235) & (rgb[:, :, 1] > 200) & (rgb[:, :, 2] > 140)
    blue = opaque & (rgb[:, :, 2] > 150) & (rgb[:, :, 0] < 120)
    ochre = (
        opaque & ~navy & ~cream & ~blue & (rgb[:, :, 0] > 150) & (rgb[:, :, 1] > 90) & (rgb[:, :, 2] < 140)
    )

    def component(mask, seed):
        im = Image.fromarray(np.where(mask, 128, 0).astype(np.uint8)).copy()
        ImageDraw.floodfill(im, seed, 255, thresh=0)
        return np.array(im) == 255

    def dist(mask, maxr):
        # Chebyshev distance to the mask, capped at maxr + 1.
        d = np.full(mask.shape, maxr + 1, float)
        cur = mask.copy()
        d[cur] = 0
        im = Image.fromarray(cur.astype(np.uint8) * 255)
        for r in range(1, maxr + 1):
            im = im.filter(ImageFilter.MaxFilter(3))
            nxt = np.array(im) > 0
            d[nxt & ~cur] = r
            cur = nxt
        return d

    S = np.array(ARM_SHOULDER, float)
    Wr = np.array(ARM_WRIST, float)
    axis = Wr - S
    yy, xx = np.mgrid[0:H, 0:W]
    # t = 0 at the shoulder, 1 at the wrist, >1 on the hoof
    t = ((xx - S[0]) * axis[0] + (yy - S[1]) * axis[1]) / (axis @ axis)
    roi = (t > -0.06) & (xx < 262) & (yy < 660)

    # Arm fur: the ochre blob under the seed, cut off at the shoulder root.
    fill = component(ochre & roi, (150, 540))
    # Navy that is nearer the arm fur than any other coloured body part is the
    # arm's outline (and the hoof). Grey anti-alias pixels don't get a vote.
    other = opaque & ~navy & ~fill & ~cream & (sat > 30)
    d_arm = dist(fill, 70)
    d_other = dist(other, 70)
    arm_navy = component((navy & roi & (d_arm <= d_other + 1)) | fill, (150, 540)) & navy
    arm = fill | arm_navy
    # ...plus the arm's own anti-aliased silhouette.
    arm |= opaque & ~arm & ~cream & (dist(arm, 4) <= 3) & (d_arm < d_other)
    # Close pinholes left by outline/cheek blend pixels, without ever taking
    # navy that belongs to the head.
    closed = Image.fromarray(arm.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    arm |= (np.array(closed) > 0) & opaque & ~(navy & ~arm_navy)
    arm &= roi
    # Pad by 2px into (semi)transparent background only: never into the head
    # outline next to the wrist, and not into cheek cream either, or light
    # specks ride along when the arm passes over darker fur.
    padded = dist(arm, 3) <= 2
    sticker = arm | (padded & ~opaque)
    # The silhouette also carries a fully opaque light-grey anti-alias halo up
    # to ~4px out. Any of it that belongs to the arm (nearer the arm than to
    # any other solid pixel) must move with the arm, or it stays behind as a
    # dotted outline of the resting pose.
    transparent = alpha <= 8
    halo = opaque & (sat < 40) & (lum > 120) & (dist(transparent, 3) <= 2)
    solid = opaque & ~halo & ~sticker
    d_sticker = dist(sticker, 12)
    d_solid = dist(solid, 12)
    sticker |= halo & (d_sticker <= 8) & (d_sticker < d_solid) & roi
    # Absorb small opaque fragments touching the sticker (stray bits of the
    # arm's own outline); big neighbours like the head outline are left alone.
    leftover = opaque & ~sticker
    touching = leftover & (dist(sticker, 2) <= 1)
    seen = np.zeros_like(touching)
    for y, x in zip(*np.where(touching)):
        if seen[y, x]:
            continue
        comp = component(leftover, (int(x), int(y)))
        seen |= comp
        if comp.sum() <= 80:
            sticker |= comp
    # ...and pad around everything too
    sticker |= (dist(sticker, 3) <= 2) & ~opaque

    def smoothstep(a, b, x):
        u = np.clip((x - a) / (b - a), 0, 1)
        return u * u * (3 - 2 * u)

    # Ramp starts above the neckerchief junction (t ~ 0.07) so that seam is
    # pinned exactly.
    shoulder_w = smoothstep(0.12, 0.5, t)
    wrist_w = smoothstep(0.86, 1.06, t)
    # Weights must stay smooth well past the sticker: grid cells that straddle
    # the moving/static boundary get stretched, and if any drawn texel falls in
    # such a cell it smears into a dotted trail beside the arm.
    near = dist(sticker, 34) <= 32
    out = Image.merge(
        "RGB",
        (
            # Base and arm mesh both threshold this at 0.5, so they partition
            # the drawing exactly and the rest pose has no seam.
            Image.fromarray((sticker * 255).astype(np.uint8)),
            Image.fromarray((shoulder_w * near * 255).astype(np.uint8)),
            Image.fromarray((wrist_w * near * 255).astype(np.uint8)),
        ),
    )
    out.save(ROOT / "public/mascot-wave-arm.png")
    ys, xs = np.where(sticker)
    print("arm px", int(arm.sum()), "sticker bbox", (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())))


if __name__ == "__main__":
    main()
