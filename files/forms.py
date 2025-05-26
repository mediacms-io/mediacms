from crispy_forms.bootstrap import FormActions
from crispy_forms.helper import FormHelper
from crispy_forms.layout import Field, Layout, Submit
from django import forms
from django.conf import settings

from .methods import get_next_state, is_mediacms_editor
from .models import MEDIA_STATES, Category, Media, Subtitle


class CustomField(Field):
    template = 'cms/crispy_custom_field.html'


class MultipleSelect(forms.CheckboxSelectMultiple):
    input_type = "checkbox"


class MediaMetadataForm(forms.ModelForm):
    new_tags = forms.CharField(label="Tags", help_text="a comma separated list of tags.", required=False)

    class Meta:
        model = Media
        fields = (
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
            "add_date": forms.DateInput(attrs={'type': 'date'}),
            "thumbnail_time": forms.NumberInput(attrs={'min': 0, 'step': 0.1}),
        }
        labels = {
            "uploaded_poster": "Poster Image",
            "thumbnail_time": "Thumbnail Time (seconds)",
        }
        help_texts = {
            "title": "",
            "thumbnail_time": "Select the time in seconds for the video thumbnail",
            "uploaded_poster": "Maximum file size: 5MB",
        }

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(MediaMetadataForm, self).__init__(*args, **kwargs)
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
        self.helper.layout = Layout(
            CustomField('title'),
            CustomField('new_tags'),
            CustomField('add_date'),
            CustomField('description'),
            CustomField('uploaded_poster'),
            CustomField('enable_comments'),
        )

        if self.instance.media_type == "video":
            self.helper.layout.append(CustomField('thumbnail_time'))

        self.helper.layout.append(FormActions(Submit('submit', 'Update Media', css_class='primaryAction')))

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
        fields = (
            "category",
            "state",
            "featured",
            "reported_times",
            "is_reviewed",
            "allow_download",
        )

        widgets = {
            "category": MultipleSelect(),
        }

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(MediaPublishForm, self).__init__(*args, **kwargs)
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

        if getattr(settings, 'USE_RBAC', False) and 'category' in self.fields:
            rbac_categories = categories.filter(is_rbac_category=True).values_list('title', flat=True)

            if rbac_categories and state in ['private', 'unlisted']:
                # Make the confirm_state field visible and add it to the layout
                self.fields['confirm_state'].widget = forms.CheckboxInput()

                # add it after the state field
                state_index = None
                for i, layout_item in enumerate(self.helper.layout):
                    if isinstance(layout_item, CustomField) and layout_item.fields[0] == 'state':
                        state_index = i
                        break

                if state_index:
                    layout_items = list(self.helper.layout)
                    layout_items.insert(state_index + 1, CustomField('confirm_state'))
                    self.helper.layout = Layout(*layout_items)

                if not cleaned_data.get('confirm_state'):
                    error_message = f"I understand that although media state is {state}, the media is also shared with users that have access to the following categories: {', '.join(rbac_categories)}"
                    self.add_error('confirm_state', error_message)

        return cleaned_data

    def save(self, *args, **kwargs):
        data = self.cleaned_data
        state = data.get("state")
        if state != self.initial["state"]:
            self.instance.state = get_next_state(self.user, self.initial["state"], self.instance.state)

        media = super(MediaPublishForm, self).save(*args, **kwargs)

        return media


class SubtitleForm(forms.ModelForm):
    class Meta:
        model = Subtitle
        fields = ["language", "subtitle_file"]

    def __init__(self, media_item, *args, **kwargs):
        super(SubtitleForm, self).__init__(*args, **kwargs)
        self.instance.media = media_item
        self.fields["subtitle_file"].help_text = "SubRip (.srt) and WebVTT (.vtt) are supported file formats."
        self.fields["subtitle_file"].label = "Subtitle or Closed Caption File"

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
