from rest_framework import status, viewsets
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Document
from .serializers import DocumentSerializer


class DocumentViewSet(viewsets.ModelViewSet):
	"""CRUD for patient documents.

	list: supports filtering by ?patient=<id> and ?type=<document_type>
	create: accepts multipart uploads (file + patient + document_type + tags)
	"""

	queryset = Document.objects.select_related("patient")
	serializer_class = DocumentSerializer
	permission_classes = [IsAuthenticated]
	parser_classes = [MultiPartParser, FormParser]

	def get_queryset(self):
		qs = super().get_queryset()
		patient = self.request.query_params.get("patient")
		doc_type = self.request.query_params.get("type")
		if patient:
			qs = qs.filter(patient_id=patient)
		if doc_type:
			qs = qs.filter(document_type=doc_type)
		return qs

	def create(self, request, *args, **kwargs):
		serializer = self.get_serializer(data=request.data)
		try:
			serializer.is_valid(raise_exception=True)
		except Exception as e:
			return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

		self.perform_create(serializer)
		headers = self.get_success_headers(serializer.data)
		return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
