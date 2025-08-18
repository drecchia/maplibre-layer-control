1.
Overlay new field persistent: t/f, to disallow memory store to remember its states ( do no remember checked state )
2.
Remove previous warnings of unexistence when loading from store
3.
Should be groupId on overlay

const groups = [
      {
        id: 'demo-group',
        label: 'Demo Group'
      }
    ];

    const overlays = [
      {
        id: 'group-point-1',
        label: 'Group Point 1',
        group: 'demo-group',


4. IMPORTANTE
Move getTooltip from overlay to decklayers
6.
Overlay priority ( like zindex )
7.
Not working:
toogling multi times changing layers order
8.
RenderOnClick should respect minZoomLevel, and should be possible to call multiples times considering bbox
9.
Rename overlay to LayerGroup
10.
All two callbacks onSelect, onDeleselect on Overlay



V2
===
1. Removing overlay leaves empty groups on UI
2. fitBounds é calculado antes, mas para renderOnClick pode ser um problema
