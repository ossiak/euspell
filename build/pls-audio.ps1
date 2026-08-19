<#
.SYNOPSIS
  Renders the IPA of dict/euspell_tts.pls to an MP3, for checking pronunciations
  by ear while hand-editing the file.

.DESCRIPTION
  The phoneme fields are spoken through SAPI's SSML <phoneme alphabet="ipa">, so
  what you hear is the transcription as written -- not the engine's own guess at
  the grapheme. (Verified: feeding "annexes" the IPA of "abstractz" makes it say
  abstracts. If SAPI were ignoring the IPA the two would be identical.)

  The file holds ~35,000 lexemes, which is roughly eleven hours of audio, so a
  selection is required rather than optional. -Match, -Skip and -Take narrow it.

  Alongside the MP3 it writes a TSV index of start times, so any entry you hear a
  problem in can be found in the file immediately. Entries whose IPA SAPI cannot
  parse are skipped and listed at the end -- those are usually typos, which makes
  the failure list useful in its own right.

.EXAMPLE
  # everything starting "annex", with the traditional spelling announced first
  ./build/pls-audio.ps1 -Match '^annex' -SayWord

.EXAMPLE
  # a flat slice of 200 entries, IPA only, half-second gaps
  ./build/pls-audio.ps1 -Skip 4000 -Take 200

.EXAMPLE
  # just the entries edited since the last commit, staged or not
  ./build/pls-audio.ps1 -Changed -SayWord
#>
[CmdletBinding()]
param(
  # Regex matched against the euspell grapheme AND the traditional spelling.
  [string] $Match = '',
  [int]    $Skip = 0,
  [int]    $Take = 100,
  # Say the traditional spelling before the IPA, so entries are identifiable by
  # ear. Costs about a second an entry; without it you get pronunciations with
  # nothing to anchor them to.
  [switch] $SayWord,
  [double] $Gap = 0.5,
  [ValidateSet('David', 'Zira')]
  [string] $Voice = 'David',
  [string] $Out = '',
  # Alternate lexicon file; defaults to dict/euspell_tts.pls.
  [string] $Pls = '',
  # Only the lexemes whose line differs from HEAD -- staged or not. Turns this
  # from a browsing tool into a check on the edit you just made. Implies no
  # -Take limit unless one is given explicitly.
  [switch] $Changed
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

$root = Split-Path $PSScriptRoot -Parent
if ($Pls -ne '') { $pls = $Pls } else { $pls = Join-Path $root 'dict/euspell_tts.pls' }
$ffmpeg = 'e:/Projects/Euspell/Videos/ffmpeg.exe'
if (-not (Test-Path $pls))    { throw "not found: $pls" }
if (-not (Test-Path $ffmpeg)) { throw "ffmpeg not found: $ffmpeg" }

if ($Out -eq '') { $Out = Join-Path $root 'dict/pls-audio.mp3' }
$pcm = [System.IO.Path]::ChangeExtension($Out, '.pcm')
$tsv = [System.IO.Path]::ChangeExtension($Out, '.tsv')

# --- select the entries ------------------------------------------------------
# The trailing comment carries the traditional spelling: <!-- annexes -->
$rx = [regex]'<grapheme>([^<]+)</grapheme><phoneme>([^<]+)</phoneme></lexeme>(?:\s*<!--\s*([^>]*?)\s*-->)?'
$text = Get-Content $pls -Raw -Encoding UTF8

$all = foreach ($m in $rx.Matches($text)) {
  [pscustomobject]@{
    Grapheme = $m.Groups[1].Value
    Ipa      = $m.Groups[2].Value
    Word     = $m.Groups[3].Value
  }
}
Write-Host ("{0} lexemes in the file" -f $all.Count)

$sel = $all

if ($Changed) {
  # Added lines only: a modified lexeme shows up as a - / + pair, and the + side
  # carries the IPA as it now stands. Against HEAD rather than the index, so a
  # staged edit is still checkable.
  $diff = & git -C $root diff HEAD -- $pls
  if ($LASTEXITCODE -ne 0) { throw "git diff failed for $pls" }
  $touched = New-Object System.Collections.Generic.HashSet[string]
  foreach ($line in $diff) {
    if ($line -and $line.StartsWith('+') -and -not $line.StartsWith('+++')) {
      foreach ($m in $rx.Matches($line)) { [void]$touched.Add($m.Groups[1].Value) }
    }
  }
  if ($touched.Count -eq 0) { throw "no lexeme changes against HEAD in $pls" }
  Write-Host ("{0} lexemes changed against HEAD" -f $touched.Count)
  $sel = $sel | Where-Object { $touched.Contains($_.Grapheme) }
  if (-not $PSBoundParameters.ContainsKey('Take')) { $Take = [int]::MaxValue }
}

if ($Match -ne '') { $sel = $sel | Where-Object { $_.Grapheme -match $Match -or $_.Word -match $Match } }
# @() so a single match still counts as one: in PowerShell 5.1 a lone object
# has no .Count, which printed an empty tally and made the guard below useless.
$sel = @($sel | Select-Object -Skip $Skip -First $Take)
if ($sel.Count -eq 0) { throw "no entries matched" }
Write-Host ("{0} selected  (voice: {1}, gap: {2}s, announce word: {3})" -f $sel.Count, $Voice, $Gap, [bool]$SayWord)

# --- synthesize --------------------------------------------------------------
$RATE = 22050
$BYTES_PER_SEC = $RATE * 2          # 16-bit mono
$esc = { param($s) [System.Security.SecurityElement]::Escape($s) }
$gapMs = [int]($Gap * 1000)

$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
  $RATE, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
  [System.Speech.AudioFormat.AudioChannel]::Mono)

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice("Microsoft $Voice Desktop")
$fs = [System.IO.File]::Create($pcm)
$synth.SetOutputToAudioStream($fs, $fmt)

$index = New-Object System.Collections.Generic.List[object]
$failed = New-Object System.Collections.Generic.List[object]
$n = 0

foreach ($e in $sel) {
  $n++
  if ($n % 25 -eq 0) { Write-Host ("  {0}/{1}" -f $n, $sel.Count) }

  $inner = ''
  if ($SayWord -and $e.Word -ne '') {
    $inner += (& $esc $e.Word) + '<break time="250ms"/>'
  }
  $inner += '<phoneme alphabet="ipa" ph="' + (& $esc $e.Ipa) + '">' + (& $esc $e.Grapheme) + '</phoneme>'
  $inner += '<break time="' + $gapMs + 'ms"/>'

  $ssml = '<?xml version="1.0"?><speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">' + $inner + '</speak>'

  $start = $fs.Position
  try {
    $synth.SpeakSsml($ssml)
  } catch {
    # A phoneme SAPI cannot parse is nearly always a typo in the IPA. Skip it,
    # keep going, and report it -- that list is worth as much as the audio.
    $failed.Add([pscustomobject]@{ Grapheme = $e.Grapheme; Ipa = $e.Ipa; Reason = $_.Exception.Message })
    continue
  }
  $end = $fs.Position

  $index.Add([pscustomobject]@{
    Start     = [math]::Round($start / $BYTES_PER_SEC, 2)
    Seconds   = [math]::Round(($end - $start) / $BYTES_PER_SEC, 2)
    Grapheme  = $e.Grapheme
    Word      = $e.Word
    Ipa       = $e.Ipa
  })
}

$synth.SetOutputToNull()
$synth.Dispose()
$fs.Close()

# --- encode ------------------------------------------------------------------
& $ffmpeg -hide_banner -loglevel error -y -f s16le -ar $RATE -ac 1 -i $pcm -codec:a libmp3lame -q:a 4 $Out
if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed ($LASTEXITCODE)" }
Remove-Item $pcm -Force

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("start`tseconds`tgrapheme`tword`tipa")
foreach ($r in $index) {
  $lines.Add(("{0}`t{1}`t{2}`t{3}`t{4}" -f $r.Start, $r.Seconds, $r.Grapheme, $r.Word, $r.Ipa))
}
[System.IO.File]::WriteAllLines($tsv, $lines, (New-Object System.Text.UTF8Encoding($false)))

$dur = [math]::Round(((Get-Item $Out).Length * 0 + ($index | Measure-Object -Property Seconds -Sum).Sum), 1)
Write-Host ""
Write-Host ("wrote {0}  ({1} entries, {2}s, {3} KB)" -f $Out, $index.Count, $dur, [int]((Get-Item $Out).Length / 1KB))
Write-Host ("index {0}" -f $tsv)
if ($failed.Count -gt 0) {
  Write-Host ""
  Write-Host ("{0} entries SAPI could not parse -- check these transcriptions:" -f $failed.Count)
  $failed | ForEach-Object { Write-Host ("  {0}  {1}" -f $_.Grapheme, $_.Ipa) }
}
