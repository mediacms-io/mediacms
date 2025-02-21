from allauth.socialaccount.adapter import DefaultSocialAccountAdapter

class SAMLAccountAdapter(DefaultSocialAccountAdapter):
    def pre_social_login(self, request, sociallogin):
        user = sociallogin.user
        data = sociallogin.data
        role = data.get("role", "")

        return super().pre_social_login(request, sociallogin)

    def populate_user(self, request, sociallogin, data):
        user = sociallogin.user
        uid = sociallogin.account.uid
        user.username = sociallogin.account.uid
        for item in ["name"]:
            if data.get(item):
                setattr(user, item, data[item])
        sociallogin.data = data
        return user

