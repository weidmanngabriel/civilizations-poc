# Character Lab Architecture

## Abgrenzung

Das Character Lab ist eine eigenständige Vite-Seite unter `/character-lab/`. Es nutzt das als Projektabhängigkeit gebundelte Three.js ausschließlich für die 3D-Vorschau. Vite nimmt Three.js in den Build auf; zur Laufzeit gibt es keine CDN-Abhängigkeit. Das Hauptspiel und Phaser sind nicht beteiligt.

## Datenmodell

### Character Definition

`character.json` beschreibt die verfügbaren Körperteile, ihre Hierarchie, die verfügbaren Bewegungsachsen und deren Neutralwinkel. Es gibt keine künstlichen Gelenkgrenzen.

v1 besitzt:

- `head`: yaw und pitch
- `leftArm`, `rightArm`: pitch ohne künstliche Winkelgrenze
- `leftLeg`, `rightLeg`: pitch
- `torso`: pitch um den Hüftpunkt; die Bewegung nimmt Kopf und Arme als gemeinsamen Oberkörper mit

Winkel werden in Grad gespeichert. Sie sind absolute lokale Winkel relativ zum neutralen Parent-Transform.

### Animation

Animationsdateien verwenden:

```json
{
  "schema": "civilizations-character-animation",
  "version": 1,
  "id": "walk",
  "interpolation": "easeInOut",
  "keyframes": [
    {
      "progress": 0,
      "pose": {
        "leftArm.pitch": -30
      }
    }
  ]
}
```

`progress` liegt immer zwischen 0 und 1. `interpolation` legt die Zeitkurve zwischen benachbarten Keyframes fest: `linear`, `easeIn`, `easeOut` oder `easeInOut`. Die Ease-Varianten verwenden kubische Kurven; `easeInOut` beschleunigt und bremst an beiden Segmentenden weich. Fehlende ältere `interpolation`-Felder werden beim Import als `linear` gelesen und beim nächsten Export explizit geschrieben. Fehlende Pose-Tracks behalten ihren zuletzt bekannten Wert beziehungsweise die Neutralpose.

Die reale Dauer gehört nicht zur Animationsdatei. Ein späterer Consumer kann eine Animation auf eine beliebige Dauer abbilden.

## Rendering

Three.js rendert:

- orthografische Kamera,
- einfache Box-Geometrien,
- flache Standardmaterialien,
- Bodenraster zur Orientierung,
- einen Character-Root für die Drehung der gesamten Figur.

Arme und Beine rotieren an Schulter/Hüfte nur vorwärts/rückwärts. Der Kopf rotiert lokal um yaw/pitch. Gelenkwinkel werden als endliche Werte validiert, aber nicht geclamped.

## Oberfläche

Die 3D-Vorschau liegt kompakt als sticky Bereich oberhalb der Editor-Regler. Beim Scrollen durch Timeline, Pose- und Ansichtssteuerung bleibt der Charakter sichtbar. Auf kleinen Displays wird die Vorschau weiter reduziert, ohne die grundlegende Touch-Bedienung zu entfernen.

## Steuerkern

Die UI benutzt dieselben Funktionen wie die Browser-API. Dadurch gibt es keinen separaten Automatisierungspfad.

`window.characterLab` stellt in v1 mindestens bereit:

- `getState()`
- `setProgress(value)`
- `setPartAngle(part, axis, degrees)`
- `setCharacterYaw(degrees)`
- `setInterpolation(mode)`
- `loadAnimation(animation)`
- `exportAnimation()`
- `setKeyframe(progress, pose?)`
- `deleteKeyframe(progress)`
- `play()`
- `pause()`

Alle Mutationen validieren Eingaben. Pose-Winkel und Root-Motion werden nicht künstlich geclamped; nur semantisch begrenzte UI-Werte wie Timeline-Fortschritt und Zoom bleiben begrenzt. Die API ist bewusst lokal und synchron/Promise-frei, soweit kein Dateidialog beteiligt ist.

## Dateien

```text
character-lab/
  index.html
  agents.md
  architecture.md
  concept.md
  src/
    main.ts
    style.css
```

v1 hält den Code bewusst kompakt. Erst wenn Modellvarianten oder weitere Assettypen hinzukommen, soll der Steuerkern in gemeinsame Module unter `src/characters/` ausgelagert werden.


## PWA-Updates

Das Character Lab verwendet denselben `installPwaSupport()`-Mechanismus wie die Haupt-App. Der gemeinsame Service Worker bleibt auf `/civilizations-poc/` gescoped. Das Lab prüft über das uncached `version.json` beim Start, beim Wieder-Sichtbarwerden, nach Wiederherstellung der Netzwerkverbindung und alle fünf Minuten auf einen neueren Build.

Bei einer Abweichung wird derselbe manuelle Update-Banner wie in der Haupt-App angezeigt. Das Lab lädt nicht automatisch neu, damit eine laufende Bearbeitung nicht ungefragt verloren geht. Der Nutzer löst Aktualisierung und Reload explizit über „Neu laden“ aus.


## Root motion, tools and segment easing

Animation poses may additionally contain `root.x`, `root.z` and `root.yaw`. These values move and rotate the animated character inside the Character Lab scene while the manual preview rotation remains a separate outer transform.

Each keyframe may optionally define `interpolation`. That value controls only the segment from that keyframe to the next one and overrides the animation-level default. This allows work motions to use different timing curves inside one animation, for example `easeIn` for an accelerating axe strike and `easeInOut` for the recovery.

Animations may also specify `previewDurationMs`. This is only the Character-Lab playback duration; normalized progress remains 0..1 and gameplay duration stays outside the animation asset.

The current v1 tool prop is a simple axe attached directly to the right-arm hierarchy. It is shown by the bundled `woodcut` preset and follows the arm automatically. The axe group is rotated 180° around its local Y axis because the prop's modeled forward side is opposite the arm/character forward convention; this keeps the axe head facing the tree throughout the overhead downstroke.


## Automated visual review

The Character Lab supports a deterministic capture mode through query parameters, for example `/character-lab/?capture=woodcut&progress=0.45`. Capture mode hides the editor chrome, pauses playback and renders a fixed animation progress with a stable preview yaw/zoom.

`window.characterLab` exposes `captureFrame(progress)` and `captureFrames(progressValues)`. These use the same animation state as the UI and return PNG data URLs after an explicit render.

`scripts/capture-character-lab.mjs` serves the dedicated Character-Lab production build from `dist-character-lab` locally and keeps one headless Chrome session open through the DevTools protocol. It writes 21 evenly spaced PNGs plus a low-resolution 640×480 WebM sampled from real rendered animation states. The default video uses 8 fps and VP9 with a high CRF so review remains quick and small. CI uploads PNG and WebM together as a `character-lab-review-<sha>` workflow artifact. This artifact is the preferred input for automated or agent-led visual review.


### Woodcut motion

The block character's local forward direction is `-Z`. Woodcut root yaw is therefore authored from each work position toward the tree center: about 180° at the south position, 60° at north-east and -60° at north-west, with continuous inward-facing values during the sidesteps.

Each chop keeps both the raised pose and impact on the local forward/tree side. The axe arm travels from roughly 155° (overhead) down to roughly 48° (forward/downward), so the visible path is top-down toward the imaginary trunk rather than an upward or outward swing. Torso and root motion add weight transfer toward the center.

## Dedicated CI/build pipeline

Character Lab visual review is isolated from the main game deployment workflow. `.github/workflows/character-lab-review.yml` is triggered only by Character-Lab/review-tooling changes (or manually).

The review workflow uses:
- `tsconfig.character-lab.json` to type-check only Character Lab plus its shared PWA helper,
- `vite.character-lab.config.ts` to build only `character-lab/index.html` into `dist-character-lab`,
- `npm run preview:character-lab` to serve that dedicated output during capture,
- ffmpeg only inside the review workflow.

The main `deploy.yml` has no ffmpeg installation, no animation capture and no review-artifact upload.
