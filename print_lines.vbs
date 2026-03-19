Set fso = CreateObject("Scripting.FileSystemObject")
args = WScript.Arguments
If args.Count = 0 Then
    WScript.Echo "Usage: cscript //NoLogo print_lines.vbs <file> [start] [end]"
    WScript.Quit 1
End If
filePath = args(0)
startLine = 1
endLine = 0
If args.Count >= 2 Then startLine = CInt(args(1))
If args.Count >= 3 Then endLine = CInt(args(2))
If startLine < 1 Then startLine = 1
Set file = fso.OpenTextFile(filePath)
lineNum = 0
Do While Not file.AtEndOfStream
    lineNum = lineNum + 1
    lineText = file.ReadLine
    If lineNum >= startLine And (endLine = 0 Or lineNum <= endLine) Then
        WScript.Echo lineNum & ":" & lineText
    End If
    If endLine > 0 And lineNum >= endLine Then Exit Do
Loop
file.Close
