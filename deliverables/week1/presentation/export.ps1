$ErrorActionPreference='Stop'
try{$ppt=New-Object -ComObject PowerPoint.Application}catch{Write-Output 'NO_POWERPOINT';exit 3}
$dir=(Get-Location).Path
$src=Join-Path $dir 'PRISM_Week1_Review.pptx'
$out=Join-Path $dir 'render'
$pres=$ppt.Presentations.Open($src,$true,$false,$false)
for($i=1;$i -le $pres.Slides.Count;$i++){$n='{0:D2}' -f $i;$f=Join-Path $out ("slide-$n.png");$pres.Slides.Item($i).Export($f,'PNG',1280,720)}
$c=$pres.Slides.Count
$pres.Close();$ppt.Quit()
Write-Output ('EXPORTED ' + $c)