import logging
import mimetypes
import os

import requests
from django.conf import settings
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Document
from .serializers import DocumentSerializer
from appointments.models import Appointment
from patients.models import Patient

logger = logging.getLogger(__name__)


class DocumentViewSet(viewsets.ModelViewSet):
	"""CRUD for patient documents.

	list: supports filtering by ?patient=<id> and ?type=<document_type>
	create: accepts multipart uploads (file + patient + document_type + tags)
	run_ocr: POST /api/documents/{id}/run-ocr/ — synchronous call to ai-service
	"""

	queryset = Document.objects.select_related("patient")
	serializer_class = DocumentSerializer
	permission_classes = [IsAuthenticated]
	parser_classes = [MultiPartParser, FormParser, JSONParser]

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

	@action(detail=True, methods=["post"], url_path="run-ocr")
	def run_ocr(self, request, pk=None):
		"""Manually trigger OCR. Never 500s if ai-service is down."""
		document = self.get_object()
		document.processing_status = Document.ProcessingStatus.PROCESSING
		document.save(update_fields=["processing_status"])

		try:
			filename = os.path.basename(document.file.name)
			content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
			url = settings.AI_SERVICE_URL.rstrip("/") + "/extract/"

			with document.file.open("rb") as fh:
				response = requests.post(
					url,
					files={"file": (filename, fh, content_type)},
					timeout=settings.AI_SERVICE_TIMEOUT,
				)
			response.raise_for_status()
			payload = response.json()
			text = payload.get("text") if isinstance(payload, dict) else None
			if text is None:
				text = str(payload)

			document.extracted_text = text
			if isinstance(payload, dict):
				document.extracted_name = payload.get("extracted_name") or None
				document.extracted_date = payload.get("extracted_date") or None
				document.extracted_age = payload.get("extracted_age") or None
				document.extracted_medicines = payload.get("extracted_medicines") or []
				document.extracted_amount = payload.get("extracted_amount") or None
			document.processing_status = Document.ProcessingStatus.PROCESSED
			document.save(update_fields=["extracted_text", "extracted_name", "extracted_date", "extracted_age", "extracted_medicines", "extracted_amount", "processing_status"])

			auto_update_message = "No matching appointment found for auto-update — please review manually."
			name = (document.extracted_name or "").strip()
			if name:
				matches = Patient.objects.filter(full_name__iexact=name)
				if matches.count() == 1:
					appointments = Appointment.objects.filter(
						patient=matches.first(), date=timezone.localdate(), status=Appointment.Status.SCHEDULED
					)
					if appointments.count() == 1:
						appointments.update(status=Appointment.Status.COMPLETED)
						auto_update_message = f"Appointment for {matches.first().full_name} marked completed"
			data = self.get_serializer(document).data
			data["auto_update_message"] = auto_update_message
			return Response(data)
		except Exception:
			logger.exception("OCR failed for document %s", document.pk)
			document.processing_status = Document.ProcessingStatus.NEEDS_REVIEW
			document.save(update_fields=["processing_status"])
			data = self.get_serializer(document).data
			data["detail"] = "OCR unavailable, try again"
			return Response(data, status=status.HTTP_200_OK)
