$b = [System.Convert]::FromBase64String((Get-Content '.\public\university-bg.b64' -Raw))
[IO.File]::WriteAllBytes('.\public\university-bg.jpg',$b)
$b2 = [System.Convert]::FromBase64String((Get-Content '.\ojt-mobile\assets\university-bg.b64' -Raw))
[IO.File]::WriteAllBytes('.\ojt-mobile\assets\university-bg.jpg',$b2)
Remove-Item '.\public\university-bg.b64'
Remove-Item '.\ojt-mobile\assets\university-bg.b64'
Get-Item '.\public\university-bg.jpg', '.\ojt-mobile\assets\university-bg.jpg' | Format-List Name,Length
