$file = "src/tycoon/build/BuildModeController.ts"
$content = Get-Content $file -Raw

# Remove the grid marker imports from line 13
$content = $content -replace `
  'import \{ updateGhost, removeGhost, getGhostEntity, updateGridMarker,\s+removeGridMarker \} from [''"]\.\/ghost\.js[''"];', `
  'import { updateGhost, removeGhost, getGhostEntity } from "./ghost.js";'

# Remove all calls to removeGridMarker() and updateGridMarker()
$content = $content -replace '\s*removeGridMarker\([^)]*\);\r?\n', ''
$content = $content -replace '\s*updateGridMarker\([^)]*\);\r?\n', ''

Set-Content $file $content
Write-Host "Fixed BuildModeController.ts"
