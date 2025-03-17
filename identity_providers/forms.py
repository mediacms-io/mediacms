import csv
from django import  forms
from django.core.exceptions import ValidationError
from allauth.socialaccount.models import SocialApp

class ImportCSVsForm(forms.ModelForm):

    groups_csv = forms.FileField(required=False, label="CSV file", help_text="Make sure headers are group_id, name")
    categories_csv = forms.FileField(required=False, label="CSV file", help_text="Make sure headers are group_id, name")

    class Meta:
        model = SocialApp
        fields = '__all__'
    
    def clean_groups_csv(self):
        groups_csv = self.cleaned_data.get('groups_csv')

        if not groups_csv:
            return groups_csv

        if not groups_csv.name.endswith('.csv'):
            raise ValidationError("Uploaded file must be a CSV file.")

        try:
            decoded_file = groups_csv.read().decode('utf-8').splitlines()
            csv_reader = csv.reader(decoded_file)
            headers = next(csv_reader, None)
            if not headers or 'group_id' not in headers or 'name' not in headers:
                raise ValidationError("CSV file must contain 'group_id' and 'name' headers. " f"Found headers: {', '.join(headers) if headers else 'none'}")
            groups_csv.seek(0)
            return groups_csv

        except csv.Error:
            raise ValidationError("Invalid CSV file. Please ensure the file is properly formatted.")
        except UnicodeDecodeError:
            raise ValidationError("Invalid file encoding. Please upload a CSV file with UTF-8 encoding.")


    def clean_categories_csv(self):
        categories_csv = self.cleaned_data.get('categories_csv')

        if not categories_csv:
            return categories_csv

        if not categories_csv.name.endswith('.csv'):
            raise ValidationError("Uploaded file must be a CSV file.")

        try:
            decoded_file = categories_csv.read().decode('utf-8').splitlines()
            csv_reader = csv.reader(decoded_file)
            headers = next(csv_reader, None)
            if not headers or 'group_id' not in headers or 'name' not in headers:
                raise ValidationError("CSV file must contain 'group_id' and 'name' headers. " f"Found headers: {', '.join(headers) if headers else 'none'}")
            categories_csv.seek(0)
            return categories_csv

        except csv.Error:
            raise ValidationError("Invalid CSV file. Please ensure the file is properly formatted.")
        except UnicodeDecodeError:
            raise ValidationError("Invalid file encoding. Please upload a CSV file with UTF-8 encoding.")
            
