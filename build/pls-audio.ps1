<#
.SYNOPSIS
  Renders the IPA of dict/euspell_tts.pls to an MP3, for checking pronunciations
  by ear while hand-editing the file.

.DESCRIPTION
  Three engines, all speaking the transcription as written rather than the
  engine's own guess at the grapheme:

    OneCore  Windows' modern voices, including Mark, which System.Speech cannot
             see. IPA goes in through SSML <phoneme alphabet="ipa">. Default.
    Sapi     The older desktop voices (David Desktop, Zira Desktop). Same SSML
             route; renders stress contrasts more weakly.
    Espeak   espeak-ng. Rule-based, so it pronounces exactly what is written and
             never smooths a stress mark away to sound natural -- which is what
             recommends it for checking stress, robotic though it is.

  espeak will not take IPA. Its --ipa flag is output only, and IPA fed into the
  [[...]] phoneme syntax comes back as nonsense, so the lexicon's IPA is
  translated first through build/espeak-ipa-map.tsv (see build/gen-espeak-map.py,
  which derives that table from espeak's own output). 99.89% of the file
  translates; the rest is reported and skipped rather than approximated.

  The file holds ~35,000 lexemes, roughly eleven hours of audio, so a selection
  is required rather than optional: -Match, -Skip, -Take, or -Changed.

  Alongside the MP3 it writes a TSV index of start times, so an entry that
  sounds wrong can be found in the file at once. Entries the engine cannot
  parse are skipped and listed at the end -- usually typos, which makes that
  list useful in its own right.

.EXAMPLE
  # everything starting "annex", traditional spelling announced first
  ./build/pls-audio.ps1 -Match '^annex' -SayWord

.EXAMPLE
  # just the entries edited since the last commit, through espeak
  ./build/pls-audio.ps1 -Changed -Engine Espeak

.EXAMPLE
  # a flat slice, IPA only, half-second gaps
  ./build/pls-audio.ps1 -Skip 4000 -Take 200

.EXAMPLE
  # every transcription in the file the espeak map cannot express, in seconds
  ./build/pls-audio.ps1 -DryRun
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
  [ValidateSet('OneCore', 'Sapi', 'Espeak')]
  [string] $Engine = 'OneCore',
  # OneCore: Mark (default), David, Zira.  Sapi: David (default), Zira.
  # Ignored by Espeak. Matched as a substring against the installed names.
  [string] $Voice = '',
  [string] $Out = '',
  # Alternate lexicon file; defaults to dict/euspell_tts.pls.
  [string] $Pls = '',
  # Only the lexemes whose line differs from HEAD -- staged or not. Turns this
  # from a browsing tool into a check on the edit you just made. Implies no
  # -Take limit unless one is given explicitly.
  [switch] $Changed,
  # Translate but do not speak: lists every selected entry the espeak map cannot
  # express, and writes no audio. Pure computation, so it covers all 35,000
  # lexemes in seconds where synthesizing them would take eleven hours. Implies
  # no -Take limit unless one is given, and reports through the espeak table
  # whichever -Engine is named, that being the only check possible without
  # actually synthesizing.
  [switch] $DryRun
)

$ErrorActionPreference = 'Stop'

if ($DryRun) {
  $Engine = 'Espeak'
  if (-not $PSBoundParameters.ContainsKey('Take')) { $Take = [int]::MaxValue }
}

# Mark is the best of the Windows voices for hearing stress, but it exists only
# in the OneCore set -- carrying it over as a default broke -Engine Sapi with a
# flat "no matching voice is installed". So the default follows the engine.
if ($Voice -eq '') { $Voice = if ($Engine -eq 'Sapi') { 'David' } else { 'Mark' } }

$root = Split-Path $PSScriptRoot -Parent
if ($Pls -ne '') {
  if (-not [System.IO.Path]::IsPathRooted($Pls)) { $Pls = Join-Path (Get-Location).Path $Pls }
  $pls = [System.IO.Path]::GetFullPath($Pls)
} else {
  $pls = Join-Path $root 'dict/euspell_tts.pls'
}
$ffmpeg = 'e:/Projects/Euspell/Videos/ffmpeg.exe'
$espeakExe = 'C:/Program Files/eSpeak NG/espeak-ng.exe'
if (-not (Test-Path $pls))    { throw "not found: $pls" }
if (-not (Test-Path $ffmpeg)) { throw "ffmpeg not found: $ffmpeg" }

if ($Out -eq '') { $Out = Join-Path $root 'dict/pls-audio.mp3' }
# Resolve -Out against PowerShell's location, not .NET's. The two are separate:
# Set-Location moves the former and leaves the latter wherever the process
# started, so a relative path handed straight to System.IO resolves against
# something like C:\ and fails with a denial naming a path nobody typed.
if (-not [System.IO.Path]::IsPathRooted($Out)) { $Out = Join-Path (Get-Location).Path $Out }
$Out = [System.IO.Path]::GetFullPath($Out)
$dir = Split-Path $Out -Parent
if (-not (Test-Path $dir)) { throw "output directory does not exist: $dir" }
$pcmPath = [System.IO.Path]::ChangeExtension($Out, '.pcm')
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
$shownVoice = if ($Engine -eq 'Espeak') { 'en-us' } else { $Voice }
Write-Host ("{0} selected  (engine: {1}, voice: {2}, gap: {3}s, announce word: {4})" -f `
  $sel.Count, $Engine, $shownVoice, $Gap, [bool]$SayWord)

$esc = { param($s) [System.Security.SecurityElement]::Escape($s) }
$gapMs = [int]($Gap * 1000)

# --- WAV helper --------------------------------------------------------------
# Walk the RIFF chunks rather than assuming a 44-byte header: espeak and the
# WinRT voices do not agree on what sits between "WAVE" and "data".
function Get-Wav([byte[]] $bytes) {
  $i = 12
  $rate = 22050
  while ($i + 8 -le $bytes.Length) {
    $id = [System.Text.Encoding]::ASCII.GetString($bytes, $i, 4)
    $size = [BitConverter]::ToInt32($bytes, $i + 4)
    if ($id -eq 'fmt ') { $rate = [BitConverter]::ToInt32($bytes, $i + 12) }
    elseif ($id -eq 'data') {
      $take = [Math]::Min($size, $bytes.Length - $i - 8)
      $pcm = New-Object byte[] $take
      [Array]::Copy($bytes, $i + 8, $pcm, 0, $take)
      return @{ Pcm = $pcm; Rate = $rate }
    }
    $i += 8 + $size + ($size % 2)
  }
  throw "no data chunk in WAV"
}

# --- engines -----------------------------------------------------------------
# Each $Speak returns raw PCM bytes for one entry, or throws if it cannot say it.
$script:rate = 22050

if ($Engine -eq 'Sapi') {
  Add-Type -AssemblyName System.Speech
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $installed = @($synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name })
  $pick = $installed | Where-Object { $_ -like "*$Voice*" } | Select-Object -First 1
  if (-not $pick) { throw ("voice '$Voice' is not available to Sapi. Installed: " + ($installed -join ', ')) }
  $synth.SelectVoice($pick)
  $fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
    22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
    [System.Speech.AudioFormat.AudioChannel]::Mono)
  $sapiBuf = New-Object System.IO.MemoryStream
  $synth.SetOutputToAudioStream($sapiBuf, $fmt)
  $Speak = {
    param($e)
    $inner = ''
    if ($SayWord -and $e.Word -ne '') { $inner += (& $esc $e.Word) + '<break time="250ms"/>' }
    $inner += '<phoneme alphabet="ipa" ph="' + (& $esc $e.Ipa) + '">' + (& $esc $e.Grapheme) + '</phoneme>'
    $inner += '<break time="' + $gapMs + 'ms"/>'
    $before = $sapiBuf.Position
    $synth.SpeakSsml('<?xml version="1.0"?><speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">' + $inner + '</speak>')
    $n = $sapiBuf.Position - $before
    $all = $sapiBuf.ToArray()
    $pcm = New-Object byte[] $n
    [Array]::Copy($all, $before, $pcm, 0, $n)
    return ,$pcm
  }
} elseif ($Engine -eq 'OneCore') {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media, ContentType=WindowsRuntime] | Out-Null
  [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType=WindowsRuntime] | Out-Null
  $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
  $voiceObj = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices |
    Where-Object { $_.DisplayName -like "*$Voice*" } | Select-Object -First 1
  if (-not $voiceObj) {
    $have = ([Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | ForEach-Object { $_.DisplayName }) -join ', '
    throw "voice '$Voice' not found. Installed: $have"
  }
  $synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
  $synth.Voice = $voiceObj
  $Speak = {
    param($e)
    $inner = ''
    if ($SayWord -and $e.Word -ne '') { $inner += (& $esc $e.Word) + '<break time="250ms"/>' }
    $inner += '<phoneme alphabet="ipa" ph="' + (& $esc $e.Ipa) + '">' + (& $esc $e.Grapheme) + '</phoneme>'
    $inner += '<break time="' + $gapMs + 'ms"/>'
    $ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">' + $inner + '</speak>'
    $op = $synth.SynthesizeSsmlToStreamAsync($ssml)
    $stream = $asTask.MakeGenericMethod([Windows.Media.SpeechSynthesis.SpeechSynthesisStream]).Invoke($null, @($op)).GetAwaiter().GetResult()
    $dr = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
    $asTask.MakeGenericMethod([uint32]).Invoke($null, @($dr.LoadAsync([uint32]$stream.Size))).GetAwaiter().GetResult() | Out-Null
    $bytes = New-Object byte[] $stream.Size
    $dr.ReadBytes($bytes)
    $w = Get-Wav $bytes
    $script:rate = $w.Rate
    return ,$w.Pcm
  }
} else {
  if (-not $DryRun -and -not (Test-Path $espeakExe)) { throw "espeak-ng not found: $espeakExe" }
  $mapFile = Join-Path $root 'build/espeak-ipa-map.tsv'
  if (-not (Test-Path $mapFile)) { throw "missing $mapFile (run build/gen-espeak-map.py)" }
  $norm = New-Object System.Collections.Generic.List[object]
  $lengthen = New-Object System.Collections.Generic.List[string]
  $seg = @{}
  foreach ($line in [System.IO.File]::ReadAllLines($mapFile, [System.Text.Encoding]::UTF8)) {
    if ($line -eq '' -or $line.StartsWith('#')) { continue }
    $p = $line.Split("`t")
    if ($p.Count -lt 3) { continue }
    if     ($p[0] -eq 'norm') { $norm.Add(@($p[1], $p[2])) }
    elseif ($p[0] -eq 'long') { $lengthen.Add($p[1]) }
    elseif ($p[0] -eq 'seg')  { $seg[$p[1]] = $p[2] }
  }
  $segs = @($seg.Keys | Sort-Object { $_.Length } -Descending)
  $VOWELS = 'a' + [char]0x00E6 + [char]0x0250 + [char]0x0251 + [char]0x0254 + [char]0x0259 +
            [char]0x025A + [char]0x025B + [char]0x025C + [char]0x025D + 'ei' + [char]0x026A +
            'o' + [char]0x028A + 'u' + [char]0x028C + [char]0x0252 + [char]0x00F8 + 'y'
  $PRIM = [char]0x02C8
  $SEC  = [char]0x02CC
  $LONG = [char]0x02D0
  $tmpTxt = [System.IO.Path]::ChangeExtension($Out, '.espeak.txt')
  $tmpWav = [System.IO.Path]::ChangeExtension($Out, '.espeak.wav')

  $ToEspeak = {
    param($ipa)
    $s = $ipa
    foreach ($nn in $norm) { $s = $s.Replace($nn[0], $nn[1]) }
    foreach ($v in $lengthen) { $s = [regex]::Replace($s, [regex]::Escape($v) + "(?!$LONG)", $v + $LONG) }
    # The lexicon marks stress at the syllable onset and espeak on the vowel, so
    # slide each mark right over the onset consonants. Without this most of the
    # file loses its stress marks entirely.
    $sb = New-Object System.Text.StringBuilder
    $i = 0
    while ($i -lt $s.Length) {
      if ($s[$i] -eq $PRIM -or $s[$i] -eq $SEC) {
        $j = $i + 1
        while ($j -lt $s.Length -and $VOWELS.IndexOf($s[$j]) -lt 0 -and $s[$j] -ne $PRIM -and $s[$j] -ne $SEC) {
          [void]$sb.Append($s[$j]); $j++
        }
        [void]$sb.Append($s[$i]); $i = $j
      } else { [void]$sb.Append($s[$i]); $i++ }
    }
    $s = $sb.ToString()
    $outSb = New-Object System.Text.StringBuilder
    $i = 0
    $bad = ''
    while ($i -lt $s.Length) {
      $hit = $false
      foreach ($k in $segs) {
        # CompareOrdinal, not -eq. PowerShell compares strings with the culture's
        # collation, which folds the combining vertical line below (U+0329,
        # syllabic) into the modifier letter low vertical line (U+02CC, secondary
        # stress) when they sit in context -- so "l̩iː" matched the key
        # "ˌiː" and the translator invented a stress mark that was not in
        # the transcription. -ceq does not help; only an ordinal test does.
        if ($i + $k.Length -le $s.Length -and
            [string]::CompareOrdinal($s, $i, $k, 0, $k.Length) -eq 0) {
          [void]$outSb.Append($seg[$k]); $i += $k.Length; $hit = $true; break
        }
      }
      if (-not $hit) {
        # Stress and length as modifiers: the derived table only holds the
        # stress+vowel pairs that occurred in the sample, and espeak's mnemonics
        # already encode length, so a leftover mark is redundant not unmapped.
        if     ($s[$i] -eq $PRIM) { [void]$outSb.Append("'"); $i++ }
        elseif ($s[$i] -eq $SEC)  { [void]$outSb.Append(','); $i++ }
        elseif ($s[$i] -eq $LONG) { $i++ }
        else { $bad += $s[$i]; $i++ }
      }
    }
    return @{ Mnemonics = $outSb.ToString(); Bad = $bad }
  }

  $Speak = {
    param($e)
    $t = & $ToEspeak $e.Ipa
    if ($t.Bad -ne '') { throw ("no espeak mapping for: " + $t.Bad) }
    $line = ''
    if ($SayWord -and $e.Word -ne '') { $line += $e.Word + ' ' }
    $line += '[[' + $t.Mnemonics + ']]'
    # LF only. A CR reaches espeak as a character to pronounce and it says a
    # phantom word after every entry ("dee", "six") -- silently, on every line.
    [System.IO.File]::WriteAllText($tmpTxt, $line + "`n", (New-Object System.Text.UTF8Encoding($false)))
    & $espeakExe -v en-us -w $tmpWav -f $tmpTxt
    if ($LASTEXITCODE -ne 0) { throw "espeak-ng failed ($LASTEXITCODE)" }
    $w = Get-Wav ([System.IO.File]::ReadAllBytes($tmpWav))
    $script:rate = $w.Rate
    # espeak honours no SSML, so the gap is appended as silence -- but it pads
    # every utterance with about 0.3s of its own first, which would make every
    # gap 0.8s when 0.5s was asked for. Trim its padding, then add exactly $Gap.
    $pcm = $w.Pcm
    $end = $pcm.Length - 2
    while ($end -ge 0) {
      $v = [BitConverter]::ToInt16($pcm, $end)
      if ([Math]::Abs($v) -gt 200) { break }
      $end -= 2
    }
    $keep = [Math]::Min($pcm.Length, $end + 2 + [int]($w.Rate * 2 * 0.02))  # 20ms tail
    if ($keep -lt 0) { $keep = 0 }
    $trimmed = New-Object byte[] $keep
    [Array]::Copy($pcm, 0, $trimmed, 0, $keep)
    $silence = New-Object byte[] ([int]($w.Rate * 2 * $Gap))
    return ,($trimmed + $silence)
  }
}

# --- dry run -----------------------------------------------------------------
if ($DryRun) {
  $bad = New-Object System.Collections.Generic.List[object]
  foreach ($e in $sel) {
    $t = & $ToEspeak $e.Ipa
    if ($t.Bad -ne '') {
      $bad.Add([pscustomobject]@{ Grapheme = $e.Grapheme; Word = $e.Word; Ipa = $e.Ipa; Unmapped = $t.Bad })
    }
  }
  Write-Host ""
  Write-Host ("{0} of {1} selected entries cannot be expressed in espeak's phonemes" -f $bad.Count, $sel.Count)
  if ($bad.Count -gt 0) {
    Write-Host ""
    Write-Host ("  {0,-18} {1,-18} {2,-24} {3}" -f 'grapheme', 'word', 'ipa', 'unmapped')
    foreach ($b in $bad) {
      $codes = (([char[]]$b.Unmapped) | ForEach-Object { 'U+{0:X4}' -f [int]$_ }) -join ' '
      Write-Host ("  {0,-18} {1,-18} {2,-24} {3}" -f $b.Grapheme, $b.Word, $b.Ipa, $codes)
    }
    $rep = New-Object System.Collections.Generic.List[string]
    $rep.Add("grapheme`tword`tipa`tunmapped")
    foreach ($b in $bad) { $rep.Add(("{0}`t{1}`t{2}`t{3}" -f $b.Grapheme, $b.Word, $b.Ipa, $b.Unmapped)) }
    [System.IO.File]::WriteAllLines($tsv, $rep, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host ""
    Write-Host ("list {0}" -f $tsv)
  }
  return
}

# --- synthesize --------------------------------------------------------------
$fs = [System.IO.File]::Create($pcmPath)
$index = New-Object System.Collections.Generic.List[object]
$failed = New-Object System.Collections.Generic.List[object]
$n = 0
$pos = 0

foreach ($e in $sel) {
  $n++
  if ($n % 25 -eq 0) { Write-Host ("  {0}/{1}" -f $n, $sel.Count) }
  try {
    $pcm = & $Speak $e
  } catch {
    # An IPA string the engine cannot handle is nearly always a typo. Skip it,
    # keep going, and report it -- that list is worth as much as the audio.
    $failed.Add([pscustomobject]@{ Grapheme = $e.Grapheme; Ipa = $e.Ipa; Reason = $_.Exception.Message })
    continue
  }
  $fs.Write($pcm, 0, $pcm.Length)
  $bps = $script:rate * 2
  $index.Add([pscustomobject]@{
    Start    = [math]::Round($pos / $bps, 2)
    Seconds  = [math]::Round($pcm.Length / $bps, 2)
    Grapheme = $e.Grapheme
    Word     = $e.Word
    Ipa      = $e.Ipa
  })
  $pos += $pcm.Length
}
$fs.Close()
if     ($Engine -eq 'Sapi')    { $synth.SetOutputToNull(); $synth.Dispose() }
elseif ($Engine -eq 'OneCore') { $synth.Dispose() }
else   { Remove-Item $tmpTxt, $tmpWav -Force -ErrorAction SilentlyContinue }
if ($index.Count -eq 0) { Remove-Item $pcmPath -Force; throw "nothing could be synthesized" }

# --- encode ------------------------------------------------------------------
& $ffmpeg -hide_banner -loglevel error -y -f s16le -ar $script:rate -ac 1 -i $pcmPath -codec:a libmp3lame -q:a 4 $Out
if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed ($LASTEXITCODE)" }
Remove-Item $pcmPath -Force

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("start`tseconds`tgrapheme`tword`tipa")
foreach ($r in $index) {
  $lines.Add(("{0}`t{1}`t{2}`t{3}`t{4}" -f $r.Start, $r.Seconds, $r.Grapheme, $r.Word, $r.Ipa))
}
[System.IO.File]::WriteAllLines($tsv, $lines, (New-Object System.Text.UTF8Encoding($false)))

$dur = [math]::Round(($index | Measure-Object -Property Seconds -Sum).Sum, 1)
Write-Host ""
Write-Host ("wrote {0}  ({1} entries, {2}s, {3} KB, {4} Hz)" -f $Out, $index.Count, $dur, [int]((Get-Item $Out).Length / 1KB), $script:rate)
Write-Host ("index {0}" -f $tsv)
if ($failed.Count -gt 0) {
  Write-Host ""
  Write-Host ("{0} entries could not be spoken -- check these transcriptions:" -f $failed.Count)
  $failed | ForEach-Object { Write-Host ("  {0}  {1}   ({2})" -f $_.Grapheme, $_.Ipa, $_.Reason) }
}
