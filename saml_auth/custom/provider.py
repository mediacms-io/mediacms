from allauth.socialaccount.providers.base import ProviderAccount
from allauth.socialaccount.providers.saml.provider import SAMLProvider
from django.http import HttpResponseRedirect

from saml_auth.custom.utils import build_auth


class SAMLAccount(ProviderAccount):
    pass


class CustomSAMLProvider(SAMLProvider):
    def _extract(self, data):
        custom_configuration = self.app.saml_configurations.first()
        if custom_configuration:
            provider_config = custom_configuration.saml_provider_settings
        else:
            provider_config = self.app.settings

        raw_attributes = data.get_attributes()
        attributes = {}
        attribute_mapping = provider_config.get("attribute_mapping", self.default_attribute_mapping)
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
        attributes["email_verified"] = False
        email_verified = provider_config.get("email_verified", False)
        if email_verified:
            if isinstance(email_verified, str):
                email_verified = email_verified.lower() in ["true", "1", "t", "y", "yes"]
            attributes["email_verified"] = email_verified
        # return username as the uid value
        if "uid" in attributes:
            attributes["username"] = attributes["uid"]
        # If we did not find an email, check if the NameID contains the email.
        if not attributes.get("email") and (
            data.get_nameid_format() == "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
            # Alternatively, if `use_id_for_email` is true, then we always interpret the nameID as email
            or provider_config.get("use_nameid_for_email", False)  # noqa
        ):
            attributes["email"] = data.get_nameid()

        return attributes

    def redirect(self, request, process, next_url=None, data=None, **kwargs):
        auth = build_auth(request, self)
        # If we pass `return_to=None` `auth.login` will use the URL of the
        # current view.
        redirect = auth.login(return_to="")
        self.stash_redirect_state(request, process, next_url, data, state_id=auth.get_last_request_id(), **kwargs)
        return HttpResponseRedirect(redirect)
