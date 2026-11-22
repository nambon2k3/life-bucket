{{/*
Expand the name of the chart.
*/}}
{{- define "backend.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "backend.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "backend.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "backend.labels" -}}
helm.sh/chart: {{ include "backend.chart" . }}
{{ include "backend.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "backend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "backend.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "backend.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "backend.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Secret that holds DATABASE_URL, Redis, RabbitMQ, and Ollama settings.
*/}}
{{- define "backend.envSecretName" -}}
{{- default (include "backend.fullname" .) .Values.env.existingSecret }}
{{- end }}

{{- define "backend.databaseUrl" -}}
postgresql+psycopg://{{ .Values.postgres.user | urlquery }}:{{ .Values.postgres.password | urlquery }}@{{ .Values.postgres.host }}:{{ .Values.postgres.port }}/{{ .Values.postgres.database }}
{{- end }}

{{- define "backend.redisUrl" -}}
{{- $auth := "" -}}
{{- if .root.Values.redis.password -}}
{{- $auth = printf ":%s@" (.root.Values.redis.password | urlquery) -}}
{{- end -}}
redis://{{ $auth }}{{ .root.Values.redis.host }}:{{ .root.Values.redis.port }}/{{ .db }}
{{- end }}

{{- define "backend.brokerUrl" -}}
amqp://{{ .Values.rabbitmq.user | urlquery }}:{{ .Values.rabbitmq.password | urlquery }}@{{ .Values.rabbitmq.host }}:{{ .Values.rabbitmq.port }}/{{ .Values.rabbitmq.vhost | urlquery }}
{{- end }}
