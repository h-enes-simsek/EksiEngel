from django.urls import path
from .views import WhereIsEksiSozlukView,CollectActionDataView,EksiSozlukUserStatView, MostBannedUsersView, MostBannedUsersUniqueView

urlpatterns = [
    path("where_is_eksisozluk/", WhereIsEksiSozlukView.as_view(), name="where_is_eksisozluk"),
    path('action/', CollectActionDataView.as_view(), name="action"),
    path('user_stat/', EksiSozlukUserStatView.as_view(), name="user_stat"),
    path('most_banned/', MostBannedUsersView.as_view(), name="most_banned"),
    path('most_banned_unique/', MostBannedUsersUniqueView.as_view(), name="most_banned_unique"),
]