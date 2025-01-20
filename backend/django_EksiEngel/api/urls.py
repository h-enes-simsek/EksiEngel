from django.urls import path
from .views import WhereIsEksiSozlukView,CollectActionDataView,EksiSozlukUserStatView, MostBannedUsersView, MostBannedUsersUniqueView, FailedActionsView, TotalActionView, TotalActionHTMLView

urlpatterns = [
    path("where_is_eksisozluk/", WhereIsEksiSozlukView.as_view(), name="where_is_eksisozluk"),
    path('action/', CollectActionDataView.as_view(), name="action"),
    path('user_stat/', EksiSozlukUserStatView.as_view(), name="user_stat"),
    path('most_banned/', MostBannedUsersView.as_view(), name="most_banned"),
    path('most_banned_unique/', MostBannedUsersUniqueView.as_view(), name="most_banned_unique"),
    path('failed_actions/', FailedActionsView.as_view(), name="failed_actions"),
    path('total_action/', TotalActionView.as_view(), name='total_action'),
    path('total_action_html/', TotalActionHTMLView, name='total_action_html'),  # HTML page of total_action
]