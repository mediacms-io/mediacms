## Transcription

Transcription functionality is available only for the Docker installation. To enable this feature, you must use the `docker-compose.full.yaml` file, as it contains an image with the necessary requirements.

By default, all users have the ability to send a request for a video to be transcribed, as well as transcribed and translated to English. If you wish to change this behavior, you can edit the `settings.py` file and set `USER_CAN_TRANSCRIBE_VIDEO=False`.

The transcription uses the base model of Whisper speech-to-text by default. However, you can change the model by editing the `WHISPER_MODEL` setting in `settings.py`.
