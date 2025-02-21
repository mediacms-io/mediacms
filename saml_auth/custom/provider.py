from django.http import HttpResponseRedirect
from django.urls import reverse
from django.utils.http import urlencode

from allauth.socialaccount.providers.saml.provider import SAMLProvider


class CustomSAMLProvider(SAMLProvider):
    def _extract(self, data):
        provider_config = self.app.settings
        raw_attributes = data.get_attributes()
        attributes = {}
        attribute_mapping = provider_config.get(
            "attribute_mapping", self.default_attribute_mapping
        )
        # map configured provider attributes
        for key, provider_keys in attribute_mapping.items():
            if isinstance(provider_keys, str):
                provider_keys = [provider_keys]
            for provider_key in provider_keys:
                attribute_list = raw_attributes.get(provider_key, None)
                # if more than one keys, get them all comma separated
                if attribute_list is not None and len(attribute_list) > 1:
                    attributes[key] = ",".join(attribute_list)
                    break
                elif attribute_list is not None and len(attribute_list) > 0:
                    attributes[key] = attribute_list[0]
                    break
                
        email_verified = attributes.get("email_verified")
        if email_verified:
            email_verified = email_verified.lower() in ["true", "1", "t", "y", "yes"]
            attributes["email_verified"] = email_verified
        # return username as the uid value
        if "uid" in attributes:
            attributes["username"] = attributes["uid"]
        # If we did not find an email, check if the NameID contains the email.
        if not attributes.get("email") and (
            data.get_nameid_format()
            == "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
            # Alternatively, if `use_id_for_email` is true, then we always interpret the nameID as email
            or provider_config.get("use_nameid_for_email", False)
        ):
            attributes["email"] = data.get_nameid()

        return attributes

