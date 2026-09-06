from django.urls import path
from .views import CollectActionDataView,EksiSozlukUserStatView, MostBannedUsersView, MostBannedUsersUniqueView, FailedActionsView, TotalActionView, UniqueUsersPerDayView

urlpatterns = [
    path('action/', CollectActionDataView.as_view(), name="action"),
    path('user_stat/', EksiSozlukUserStatView.as_view(), name="user_stat"),
    path('most_banned/', MostBannedUsersView.as_view(), name="most_banned"),
    path('most_banned_unique/', MostBannedUsersUniqueView.as_view(), name="most_banned_unique"),
    path('failed_actions/', FailedActionsView.as_view(), name="failed_actions"),
    path('total_action/', TotalActionView.as_view(), name='total_action'),
    path('unique_users_per_day/', UniqueUsersPerDayView.as_view(), name='unique_users_per_day'),
]
