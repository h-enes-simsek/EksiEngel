$Uri = 'https://eksiengel.hesimsek.com/client_data_collector/upload'

$FormValid = @{
    user_agent = "Mozilla 5.0"
    client_name = "test valid"
    ban_source = "FAV"
    ban_mode = "BAN"
    fav_entry_id = 123456
    fav_title_id = 555555
    fav_title_name = "test başlık"
    fav_author_id = 666666
    fav_author_name = "bad author"
    author_name_list = "['a','b']"
    author_id_list = "['1', '0']"
    author_list_size = 2
    total_action = 1
    successful_action = 1
    is_early_stopped = 0
    log_level = "ERR"
    log = "['INF deneme','ERR hata']"
}

$FormNullEntry = @{
    user_agent = ""
    client_name = "test null entry user agent"
    ban_source = "FAV"
    ban_mode = "BAN"
    fav_entry_id = 123456
    fav_title_id = 555555
    fav_title_name = "test başlık"
    fav_author_id = 666666
    fav_author_name = "bad author"
    author_name_list = "['a','b']"
    author_id_list = "['1', '0']"
    author_list_size = 2
    total_action = 1
    successful_action = 1
    is_early_stopped = 0
    log_level = "ERR"
    log = "['INF deneme','ERR hata']"
}

$FormMissingEntry = @{
    client_name = "test missing entry user agent"
    ban_source = "FAV"
    ban_mode = "BAN"
    fav_entry_id = 123456
    fav_title_id = 555555
    fav_title_name = "test başlık"
    fav_author_id = 666666
    fav_author_name = "bad author"
    author_name_list = "['a','b']"
    author_id_list = "['1', '0']"
    author_list_size = 2
    total_action = 1
    successful_action = 1
    is_early_stopped = 0
    log_level = "ERR"
    log = "['INF deneme','ERR hata']"
}

$FormWrongEnum = @{
    user_agent = "Mozilla 5.0"
    client_name = "test wrong enum ban mode"
    ban_source = "FAV"
    ban_mode = "WRONGBAN"
    fav_entry_id = 123456
    fav_title_id = 555555
    fav_title_name = "test başlık"
    fav_author_id = 666666
    fav_author_name = "bad author"
    author_name_list = "['a','b']"
    author_id_list = "['1', '0']"
    author_list_size = 2
    total_action = 1
    successful_action = 1
    is_early_stopped = 0
    log_level = "ERR"
    log = "['INF deneme','ERR hata']"
}

$FormWrongType = @{
    user_agent = 123
    client_name = "test wrong type user agent"
    ban_source = "FAV"
    ban_mode = "BAN"
    fav_entry_id = 123456
    fav_title_id = 555555
    fav_title_name = "test başlık"
    fav_author_id = 666666
    fav_author_name = "bad author"
    author_name_list = "['a','b']"
    author_id_list = "['1', '0']"
    author_list_size = 2
    total_action = 1
    successful_action = 1
    is_early_stopped = 0
    log_level = "ERR"
    log = "['INF deneme','ERR hata']"
}

$FormWrongType2 = @{
    client_name = "test wrong type2 fav_entry_id"
    fav_entry_id = "9000009"
    
    user_agent = "Mozilla 5.0"
    ban_source = "FAV"
    ban_mode = "BAN"
    fav_title_id = 555555
    fav_title_name = "test başlık"
    fav_author_id = 666666
    fav_author_name = "bad author"
    author_name_list = "['a','b']"
    author_id_list = "['1', '0']"
    author_list_size = 2
    total_action = 1
    successful_action = 1
    is_early_stopped = 0
    log_level = "ERR"
    log = "['INF deneme','ERR hata']"

}

$FormWrongType3 = @{
    client_name = "test wrong type3 fav_entry_id"
    fav_entry_id = "900asd0009"
    
    user_agent = "Mozilla 5.0"
    ban_source = "FAV"
    ban_mode = "BAN"
    fav_title_id = 555555
    fav_title_name = "test başlık"
    fav_author_id = 666666
    fav_author_name = "bad author"
    author_name_list = "['a','b']"
    author_id_list = "['1', '0']"
    author_list_size = 2
    total_action = 1
    successful_action = 1
    is_early_stopped = 0
    log_level = "ERR"
    log = "['INF deneme','ERR hata']"

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

try {
    $ResultWrongType2 = Invoke-RestMethod -Uri $Uri -Method Post -Form $FormWrongType2
    Write-Output "ResultWrongType2 $ResultWrongType2"
} catch {
    Write-Output "ResultWrongType2 StatusCode: $($_.Exception.Response.StatusCode.value__)"
}

try {
    $ResultWrongType23 = Invoke-RestMethod -Uri $Uri -Method Post -Form $FormWrongType3
    Write-Output "ResultWrongType3 $ResultWrongType3"
} catch {
    Write-Output "ResultWrongType3 StatusCode: $($_.Exception.Response.StatusCode.value__)"
}

$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown');