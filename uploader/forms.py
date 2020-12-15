from django import forms


class FineUploaderUploadForm(forms.Form):
    qqfile = forms.FileField()
    qquuid = forms.CharField()
    qqfilename = forms.CharField()
    qqpartindex = forms.IntegerField(required=False)
    qqchunksize = forms.IntegerField(required=False)
    qqtotalparts = forms.IntegerField(required=False)
    qqtotalfilesize = forms.IntegerField(required=False)
    qqpartbyteoffset = forms.IntegerField(required=False)


class FineUploaderUploadSuccessForm(forms.Form):
    qquuid = forms.CharField()
    qqfilename = forms.CharField()
    qqtotalparts = forms.IntegerField()
    qqtotalfilesize = forms.IntegerField(required=False)
