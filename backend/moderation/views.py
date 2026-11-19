from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsAccountAdmin
from .serializers import AccountActionSerializer, RestrictAccountSerializer, SuspendAccountSerializer
from .services import moderate_account


class AccountActionView(APIView):
    permission_classes = [IsAccountAdmin]
    parser_classes = [JSONParser]
    serializer_class = AccountActionSerializer
    action = "restore"
    http_method_names = ["post", "options"]

    def post(self, request, user_id):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = moderate_account(
            actor=request.user, user_id=user_id, action=self.action,
            **serializer.validated_data,
        )
        return Response(result)


class SuspendAccountView(AccountActionView):
    serializer_class = SuspendAccountSerializer
    action = "suspend"


class BanAccountView(AccountActionView):
    serializer_class = RestrictAccountSerializer
    action = "ban"
