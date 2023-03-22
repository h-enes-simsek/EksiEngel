$Uri = 'http://localhost:8000/client_data_collector/analytics'

$FormValid = @{
    user_agent = "Mozilla 5.0"
    client_name = "test valid"
    client_uid = 123456
    click_type = "FAQ_LINK_ENTRY_LIMIT"
}

$FormNullEntry = @{
    user_agent = ""
    client_name = "test null entry user agent"
    client_uid = 123456
    click_type = "FAQ_LINK_ENTRY_LIMIT"
}

$FormMissingEntry = @{
    client_name = "test missing entry user agent"
    client_uid = 123456
    click_type = "FAQ_LINK_ENTRY_LIMIT"
}

$FormWrongEnum = @{
    user_agent = "Mozilla 5.0"
    client_name = "test wrong enum click_type"
    client_uid = 123456
    click_type = "WRONG_ENUM"
}

$FormWrongType = @{
    user_agent = 123
    client_name = "test wrong type user agent"
    client_uid = 123456
    click_type = "FAQ_LINK_ENTRY_LIMIT"
}

$ResultValid = Invoke-RestMethod -Uri $Uri -Method Post -Form $FormValid
Write-Output "ResultValid $ResultValid"

try {
    $ResultNullEntry = Invoke-RestMethod -Uri $Uri -Method Post -Form $FormNullEntry
    Write-Output "ResultNullEntry $ResultNullEntry"
} catch {
    Write-Output "ResultNullEntry StatusCode: $($_.Exception.Response.StatusCode.value__)"
}

try {
    $ResultMissingEntry = Invoke-RestMethod -Uri $Uri -Method Post -Form $FormMissingEntry
    Write-Output "ResultMissingEntry $ResultMissingEntry"
} catch {
    Write-Output "ResultMissingEntry StatusCode: $($_.Exception.Response.StatusCode.value__)"
}

try {
    $ResultWrongEnum = Invoke-RestMethod -Uri $Uri -Method Post -Form $FormWrongEnum
    Write-Output "ResultWrongEnum $ResultWrongEnum"
} catch {
    Write-Output "ResultWrongEnum StatusCode: $($_.Exception.Response.StatusCode.value__)"
}


try {
    $ResultWrongType = Invoke-RestMethod -Uri $Uri -Method Post -Form $FormWrongType
    Write-Output "ResultWrongType $ResultWrongType"
} catch {
    Write-Output "ResultWrongType StatusCode: $($_.Exception.Response.StatusCode.value__)"
}

$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown');