from allauth.socialaccount.adapter import DefaultSocialAccountAdapter

class SAMLAccountAdapter(DefaultSocialAccountAdapter):
    def pre_social_login(self, request, sociallogin):
        user = sociallogin.user
        data = sociallogin.data
        first_name = data.get("first_name", "")
        last_name = data.get("last_name", "")
        name = data.get("name", "")
        role = data.get("role", "")
        #user.username = 
        user.name = name
        user.first_name = first_name
        user.last_name = last_name
        if role in ["staff"]:
            user.advancedUser = True
        # the whole list is available here. data has only the first
###        if user.id:
   ####         user.save()
        # SOS: use new user, there is no user to connect the groups. use something else
        import rpdb; rpdb.set_trace()
        social_account = sociallogin.account
        groups = social_account.extra_data.get("isMemberOf", [])
        print(groups)

        return super().pre_social_login(request, sociallogin)

    def populate_user(self, request, sociallogin, data):
#        user = super().populate_user(request, sociallogin, data)
        import rpdb; rpdb.set_trace()
        sociallogin.data = data
        return user

