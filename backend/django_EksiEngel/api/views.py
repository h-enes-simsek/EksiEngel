from django.db.models import Count, Exists, OuterRef, Q, F
from rest_framework import generics
from rest_framework import views, status
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse
from .serializers import CollectActionDataSerializer, EksiSozlukUserStatViewSerializer, MostBannedUsersSerializer, MostBannedUsersUniqueSerializer, WriteActionViewSerializer, TotalActionViewSerializer
from .models import Action, ActionConfig, EksiSozlukUser
from rest_framework.authentication import SessionAuthentication, BasicAuthentication 
from django.db.models.functions import TruncDay
from django.shortcuts import render
from django.contrib.admin.views.decorators import staff_member_required


@staff_member_required
def admin_dashboard(request):
    return render(request, 'api/admin_dashboard.html')

class CsrfExemptSessionAuthentication(SessionAuthentication):

    def enforce_csrf(self, request):
        return  # To not perform the csrf check previously happening

class CollectActionDataView(views.APIView):
    permission_classes = [AllowAny]
    authentication_classes = (CsrfExemptSessionAuthentication, BasicAuthentication)
    
    # for debug
    def get(self, request, format=None):
        serializer = CollectActionDataSerializer(None, many=False)
        return Response(serializer.data)
        
    def post(self, request, format=None):
        serializer = CollectActionDataSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class MostBannedUsersUniqueView(generics.ListAPIView):
    permission_classes = [IsAdminUser]
    authentication_classes = (CsrfExemptSessionAuthentication, BasicAuthentication)
    
    serializer_class = MostBannedUsersUniqueSerializer
    
    def get_queryset(self):
        return EksiSozlukUser.objects.annotate(banned_by_unique_count=Count('author_list_in_action__eksi_engel_user', distinct=True,  filter=Q(author_list_in_action__ban_mode__ban_mode='BAN'))).order_by('-banned_by_unique_count', 'pk')[:50]

class MostBannedUsersView(generics.ListAPIView):
    permission_classes = [IsAdminUser]
    
    serializer_class = MostBannedUsersSerializer
    
    def get_queryset(self):
        return EksiSozlukUser.objects.annotate(banned_by_count=Count('author_list_in_action', distinct=False,  filter=Q(author_list_in_action__ban_mode__ban_mode='BAN'))).order_by('-banned_by_count', 'pk')[:50]
  
class EksiSozlukUserStatView(generics.ListAPIView):
    permission_classes = [IsAdminUser]

    serializer_class = EksiSozlukUserStatViewSerializer
    queryset = EksiSozlukUser.objects.all()

# List last failed actions
class FailedActionsView(generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = WriteActionViewSerializer
        
    def get_queryset(self):
        # failed condition: is_early_stopped=False AND [ (planned_action != performed_action) OR (performed_action != successful_action) ]
        return Action.objects.filter(
                    is_early_stopped=False
               ).exclude(
                    Q(planned_action=F('performed_action')) &
                    Q(performed_action=F('successful_action'))
               ).order_by('-pk')[:10]
               
# List Total Action Number day by day
class TotalActionView(generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = TotalActionViewSerializer

    def get_queryset(self):
        return (
            Action.objects.annotate(day=TruncDay('date'))  # Group by day
            .values('day')                                # Select only the day field
            .annotate(total=Count('id'))                 # Count actions per day
            .order_by('day')                             # Sort by day
        )


# List unique active users day by day
class UniqueUsersPerDayView(generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = TotalActionViewSerializer

    def get_queryset(self):
        return (
            Action.objects.annotate(day=TruncDay('date'))
            .values('day')
            .annotate(total=Count('eksi_engel_user', distinct=True))
            .order_by('day')
        )
