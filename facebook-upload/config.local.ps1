# Facebook Graph API 設定檔
# 已填入賜安診所粉絲專頁的設定

$FacebookConfig = @{
    # Facebook Access Token (粉絲專頁專用)
    AccessToken = "EAASIk8UQj8MBRkHOyZBLv4D34yTej6PkpkaYCDtWatx3ZA3ZAfzRBWQZASboSfis7O5gUdtQ455JX2VvhqJ4tOsFZBJS6f9086WlBuErGKGmfg5wK78qa3KtY4SVBW0YdRu55ZCHErvYdcop3sBIIcxT0LERkBBhbmOOhrDZA9P0lqR10MbtaKspVyrhwvv3G0vfDOrMZA9SrMZCJPKU5r2ZANVyeeKG9hyxoMDf4xQZASbypk5hiQFQdyWbzjfJkJCHEOqV60qsvz57i0ZD"
    
    # 目標 ID（粉絲專頁 ID）
    # 賜安診所
    TargetId    = "865296870210875"
    
    # 目標類型："page" (粉絲專頁) 或 "group" (群組)
    TargetType  = "page"
    
    # API 版本
    ApiVersion  = "v18.0"
    
    # 基礎 URL
    BaseUrl     = "https://graph.facebook.com"
    
    # 班表年份（明年改為 "116"）
    ScheduleYear = "115"
}