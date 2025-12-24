from crispy_forms.bootstrap import FormActions
from crispy_forms.helper import FormHelper
from crispy_forms.layout import HTML, Field, Layout, Submit
from django import forms
from django.conf import settings

from .methods import get_next_state, is_mediacms_editor
from .models import MEDIA_STATES, Category, Media, Subtitle
from .widgets import CategoryModalWidget


class CustomField(Field):
    template = 'cms/crispy_custom_field.html'


class MultipleSelect(forms.CheckboxSelectMultiple):
    input_type = "checkbox"


class MediaMetadataForm(forms.ModelForm):
    new_tags = forms.CharField(label="Tags", help_text="a comma separated list of tags.", required=False)

    class Meta:
        model = Media
        fields = (
            "friendly_token",
            "title",
            "new_tags",
            "add_date",
            "uploaded_poster",
            "description",
            "enable_comments",
            "thumbnail_time",
        )

        widgets = {
            "new_tags": MultipleSelect(),
            "description": forms.Textarea(attrs={'rows': 4}),
            "add_date": forms.DateTimeInput(attrs={'type': 'datetime-local', 'step': '1'}, format='%Y-%m-%dT%H:%M:%S'),
            "thumbnail_time": forms.NumberInput(attrs={'min': 0, 'step': 0.1}),
        }
        labels = {
            "friendly_token": "Slug",
            "uploaded_poster": "Poster Image",
            "thumbnail_time": "Thumbnail Time (seconds)",
        }
        help_texts = {
            "title": "",
            "friendly_token": "Media URL slug",
            "thumbnail_time": "Select the time in seconds for the video thumbnail",
            "uploaded_poster": "Maximum file size: 5MB",
        }

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(MediaMetadataForm, self).__init__(*args, **kwargs)
        if not getattr(settings, 'ALLOW_CUSTOM_MEDIA_URLS', False):
            self.fields.pop("friendly_token")
        if self.instance.media_type != "video":
            self.fields.pop("thumbnail_time")
        if self.instance.media_type == "image":
            self.fields.pop("uploaded_poster")

        self.fields["new_tags"].initial = ", ".join([tag.title for tag in self.instance.tags.all()])

        self.helper = FormHelper()
        self.helper.form_tag = True
        self.helper.form_class = 'post-form'
        self.helper.form_method = 'post'
        self.helper.form_enctype = "multipart/form-data"
        self.helper.form_show_errors = False

        layout_fields = [
            CustomField('title'),
            CustomField('new_tags'),
            CustomField('add_date'),
            CustomField('description'),
            CustomField('enable_comments'),
        ]
        if self.instance.media_type != "image":
            layout_fields.append(CustomField('uploaded_poster'))

        self.helper.layout = Layout(*layout_fields)

        if self.instance.media_type == "video":
            self.helper.layout.append(CustomField('thumbnail_time'))
        if getattr(settings, 'ALLOW_CUSTOM_MEDIA_URLS', False):
            self.helper.layout.insert(0, CustomField('friendly_token'))

        self.helper.layout.append(FormActions(Submit('submit', 'Update Media', css_class='primaryAction')))

    def clean_friendly_token(self):
        token = self.cleaned_data.get("friendly_token", "").strip()

        if token:
            if not all(c.isalnum() or c in "-_" for c in token):
                raise forms.ValidationError("Slug can only contain alphanumeric characters, underscores, or hyphens.")

            if Media.objects.filter(friendly_token=token).exclude(pk=self.instance.pk).exists():
                raise forms.ValidationError("This slug is already in use. Please choose a different one.")
            return token

    def clean_uploaded_poster(self):
        image = self.cleaned_data.get("uploaded_poster", False)
        if image:
            if image.size > 5 * 1024 * 1024:
                raise forms.ValidationError("Image file too large ( > 5mb )")
            return image

    def save(self, *args, **kwargs):
        data = self.cleaned_data  # noqa

        media = super(MediaMetadataForm, self).save(*args, **kwargs)
        return media


class MediaPublishForm(forms.ModelForm):
    confirm_state = forms.BooleanField(required=False, initial=False, label="Acknowledge sharing status", help_text="")

    class Meta:
        model = Media
        fields = ("category", "state", "featured", "reported_times", "is_reviewed", "allow_download")

        widgets = {
            "category": CategoryModalWidget(),
        }

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(MediaPublishForm, self).__init__(*args, **kwargs)

        self.has_custom_permissions = self.instance.permissions.exists() if self.instance.pk else False
        self.has_rbac_categories = self.instance.category.filter(is_rbac_category=True).exists() if self.instance.pk else False
        self.is_shared = self.has_custom_permissions or self.has_rbac_categories
        self.actual_state = self.instance.state if self.instance.pk else None

        if not is_mediacms_editor(user):
            for field in ["featured", "reported_times", "is_reviewed"]:
                self.fields[field].disabled = True
                self.fields[field].widget.attrs['class'] = 'read-only-field'
                self.fields[field].widget.attrs['title'] = "This field can only be modified by MediaCMS admins or editors"

            if settings.PORTAL_WORKFLOW not in ["public"]:
                valid_states = ["unlisted", "private"]
                if self.instance.state and self.instance.state not in valid_states:
                    valid_states.append(self.instance.state)
                self.fields["state"].choices = [(state, dict(MEDIA_STATES).get(state, state)) for state in valid_states]

        if self.is_shared:
            current_choices = list(self.fields["state"].choices)
            current_choices.insert(0, ("shared", "Shared"))
            self.fields["state"].choices = current_choices
            self.fields["state"].initial = "shared"
            self.initial["state"] = "shared"

        if getattr(settings, 'USE_RBAC', False) and 'category' in self.fields:
            if is_mediacms_editor(user):
                pass
            else:
                self.fields['category'].initial = self.instance.category.all()

                non_rbac_categories = Category.objects.filter(is_rbac_category=False)
                rbac_categories = user.get_rbac_categories_as_contributor()
                combined_category_ids = list(non_rbac_categories.values_list('id', flat=True)) + list(rbac_categories.values_list('id', flat=True))

                if self.instance.pk:
                    instance_category_ids = list(self.instance.category.all().values_list('id', flat=True))
                    combined_category_ids = list(set(combined_category_ids + instance_category_ids))

                self.fields['category'].queryset = Category.objects.filter(id__in=combined_category_ids).order_by('title')

        self.helper = FormHelper()
        self.helper.form_tag = True
        self.helper.form_class = 'post-form'
        self.helper.form_method = 'post'
        self.helper.form_enctype = "multipart/form-data"
        self.helper.form_show_errors = False
        self.helper.layout = Layout(
            CustomField('category'),
            CustomField('state'),
            CustomField('featured'),
            CustomField('reported_times'),
            CustomField('is_reviewed'),
            CustomField('allow_download'),
        )

        self.helper.layout.append(FormActions(Submit('submit', 'Publish Media', css_class='primaryAction')))

    def clean(self):
        cleaned_data = super().clean()
        state = cleaned_data.get("state")
        categories = cleaned_data.get("category")

        if self.is_shared and state != "shared":
            self.fields['confirm_state'].widget = forms.CheckboxInput()
            state_index = None
            for i, layout_item in enumerate(self.helper.layout):
                if isinstance(layout_item, CustomField) and layout_item.fields[0] == 'state':
                    state_index = i
                    break

            if state_index is not None:
                layout_items = list(self.helper.layout)
                layout_items.insert(state_index + 1, CustomField('confirm_state'))
                self.helper.layout = Layout(*layout_items)

            if not cleaned_data.get('confirm_state'):
                if state == 'private':
                    error_parts = []
                    if self.has_rbac_categories:
                        rbac_cat_titles = self.instance.category.filter(is_rbac_category=True).values_list('title', flat=True)
                        error_parts.append(f"shared with users that have access to categories: {', '.join(rbac_cat_titles)}")
                    if self.has_custom_permissions:
                        error_parts.append("shared by me with other users (visible in 'Shared by me' page)")

                    error_message = f"I understand that changing to Private will remove all sharing. Currently this media is {' and '.join(error_parts)}. All this sharing will be removed."
                    self.add_error('confirm_state', error_message)
                else:
                    error_message = f"I understand that changing to {state.title()} will maintain existing sharing settings."
                    self.add_error('confirm_state', error_message)

        elif state in ['private', 'unlisted']:
            custom_permissions = self.instance.permissions.exists()
            rbac_categories = categories.filter(is_rbac_category=True).values_list('title', flat=True)
            if rbac_categories or custom_permissions:
                self.fields['confirm_state'].widget = forms.CheckboxInput()
                state_index = None
                for i, layout_item in enumerate(self.helper.layout):
                    if isinstance(layout_item, CustomField) and layout_item.fields[0] == 'state':
                        state_index = i
                        break

                if state_index is not None:
                    layout_items = list(self.helper.layout)
                    layout_items.insert(state_index + 1, CustomField('confirm_state'))
                    self.helper.layout = Layout(*layout_items)

                if not cleaned_data.get('confirm_state'):
                    if rbac_categories:
                        error_message = f"I understand that although media state is {state}, the media is also shared with users that have access to categories: {', '.join(rbac_categories)}"
                        self.add_error('confirm_state', error_message)
                    if custom_permissions:
                        error_message = f"I understand that although media state is {state}, the media is also shared by me with other users, that I can see in the 'Shared by me' page"
                        self.add_error('confirm_state', error_message)

        # Convert "shared" state to actual underlying state for saving. we dont keep shared state in DB
        if state == "shared":
            cleaned_data["state"] = self.actual_state

        return cleaned_data

    def save(self, *args, **kwargs):
        data = self.cleaned_data
        state = data.get("state")

        # If transitioning from shared to private, remove all sharing
        if self.is_shared and state == 'private' and data.get('confirm_state'):
            # Remove all custom permissions
            self.instance.permissions.all().delete()
            # Remove RBAC categories
            rbac_cats = self.instance.category.filter(is_rbac_category=True)
            self.instance.category.remove(*rbac_cats)

        if state != self.initial["state"]:
            self.instance.state = get_next_state(self.user, self.initial["state"], self.instance.state)

        media = super(MediaPublishForm, self).save(*args, **kwargs)

        return media


class WhisperSubtitlesForm(forms.ModelForm):
    class Meta:
        model = Media
        fields = (
            "allow_whisper_transcribe",
            "allow_whisper_transcribe_and_translate",
        )
        labels = {
            "allow_whisper_transcribe": "Transcription",
            "allow_whisper_transcribe_and_translate": "English Translation",
        }
        help_texts = {
            "allow_whisper_transcribe": "",
            "allow_whisper_transcribe_and_translate": "",
        }

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(WhisperSubtitlesForm, self).__init__(*args, **kwargs)

        if self.instance.allow_whisper_transcribe:
            self.fields['allow_whisper_transcribe'].widget.attrs['readonly'] = True
            self.fields['allow_whisper_transcribe'].widget.attrs['disabled'] = True
        if self.instance.allow_whisper_transcribe_and_translate:
            self.fields['allow_whisper_transcribe_and_translate'].widget.attrs['readonly'] = True
            self.fields['allow_whisper_transcribe_and_translate'].widget.attrs['disabled'] = True

        both_readonly = self.instance.allow_whisper_transcribe and self.instance.allow_whisper_transcribe_and_translate

        self.helper = FormHelper()
        self.helper.form_tag = True
        self.helper.form_class = 'post-form'
        self.helper.form_method = 'post'
        self.helper.form_enctype = "multipart/form-data"
        self.helper.form_show_errors = False
        self.helper.layout = Layout(
            CustomField('allow_whisper_transcribe'),
            CustomField('allow_whisper_transcribe_and_translate'),
        )

        if not both_readonly:
            self.helper.layout.append(FormActions(Submit('submit_whisper', 'Submit', css_class='primaryAction')))
        else:
            # Optional: Add a disabled button with explanatory text
            self.helper.layout.append(
                FormActions(Submit('submit_whisper', 'Submit', css_class='primaryAction', disabled=True), HTML('<small class="text-muted">Cannot submit - both options are already enabled</small>'))
            )

    def clean_allow_whisper_transcribe(self):
        # Ensure the field value doesn't change if it was originally True
        if self.instance and self.instance.allow_whisper_transcribe:
            return self.instance.allow_whisper_transcribe
        return self.cleaned_data['allow_whisper_transcribe']

    def clean_allow_whisper_transcribe_and_translate(self):
        # Ensure the field value doesn't change if it was originally True
        if self.instance and self.instance.allow_whisper_transcribe_and_translate:
            return self.instance.allow_whisper_transcribe_and_translate
        return self.cleaned_data['allow_whisper_transcribe_and_translate']


class SubtitleForm(forms.ModelForm):
    class Meta:
        model = Subtitle
        fields = ["language", "subtitle_file"]

        labels = {
            "subtitle_file": "Upload Caption File",
        }
        help_texts = {
            "subtitle_file": "SubRip (.srt) and WebVTT (.vtt) are supported file formats.",
        }

    def __init__(self, media_item, *args, **kwargs):
        super(SubtitleForm, self).__init__(*args, **kwargs)
        self.instance.media = media_item

        self.helper = FormHelper()
        self.helper.form_tag = True
        self.helper.form_class = 'post-form'
        self.helper.form_method = 'post'
        self.helper.form_enctype = "multipart/form-data"
        self.helper.form_show_errors = False
        self.helper.layout = Layout(
            CustomField('subtitle_file'),
            CustomField('language'),
        )

        self.helper.layout.append(FormActions(Submit('submit', 'Submit', css_class='primaryAction')))

    def save(self, *args, **kwargs):
        self.instance.user = self.instance.media.user
        media = super(SubtitleForm, self).save(*args, **kwargs)
        return media


class EditSubtitleForm(forms.Form):
    subtitle = forms.CharField(widget=forms.Textarea, required=True)

    def __init__(self, subtitle, *args, **kwargs):
        super(EditSubtitleForm, self).__init__(*args, **kwargs)
        self.fields["subtitle"].initial = subtitle.subtitle_file.read().decode("utf-8")


class ContactForm(forms.Form):
    from_email = forms.EmailField(required=True)
    name = forms.CharField(required=False)
    message = forms.CharField(widget=forms.Textarea, required=True)

    def __init__(self, user, *args, **kwargs):
        super(ContactForm, self).__init__(*args, **kwargs)
        self.fields["name"].label = "Your name:"
        self.fields["from_email"].label = "Your email:"
        self.fields["message"].label = "Please add your message here and submit:"
        self.user = user
        if user.is_authenticated:
            self.fields.pop("name")
            self.fields.pop("from_email")


class ReplaceMediaForm(forms.Form):
    new_media_file = forms.FileField(
        required=True,
        label="New Media File",
        help_text="Select a new file to replace the current media",
    )

    def __init__(self, media_instance, *args, **kwargs):
        self.media_instance = media_instance
        super(ReplaceMediaForm, self).__init__(*args, **kwargs)

        self.helper = FormHelper()
        self.helper.form_tag = True
        self.helper.form_class = 'post-form'
        self.helper.form_method = 'post'
        self.helper.form_enctype = "multipart/form-data"
        self.helper.form_show_errors = False
        self.helper.layout = Layout(
            CustomField('new_media_file'),
        )

        self.helper.layout.append(FormActions(Submit('submit', 'Replace Media', css_class='primaryAction')))

    def clean_new_media_file(self):
        file = self.cleaned_data.get("new_media_file", False)
        if file:
            if file.size > settings.UPLOAD_MAX_SIZE:
                max_size_mb = settings.UPLOAD_MAX_SIZE / (1024 * 1024)
                raise forms.ValidationError(f"File too large. Maximum size: {max_size_mb:.0f}MB")
            return file
