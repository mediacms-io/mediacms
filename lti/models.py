from django.db import models


class LTIPlatform(models.Model):
    """LTI 1.3 Platform (Moodle instance) configuration"""

    name = models.CharField(max_length=255, unique=True, help_text="Platform name (e.g., 'Moodle Production')")
    platform_id = models.URLField(help_text="Platform's issuer URL (iss claim, e.g., https://moodle.example.com)")
    client_id = models.CharField(max_length=255, help_text="Client ID provided by the platform")

    auth_login_url = models.URLField(help_text="OIDC authentication endpoint URL")
    auth_token_url = models.URLField(help_text="OAuth2 token endpoint URL")
    auth_audience = models.URLField(blank=True, null=True, help_text="OAuth2 audience (optional)")

    key_set_url = models.URLField(help_text="Platform's public JWK Set URL")
    key_set = models.JSONField(blank=True, null=True, help_text="Cached JWK Set (auto-fetched)")
    key_set_updated = models.DateTimeField(null=True, blank=True, help_text="Last time JWK Set was fetched")

    deployment_ids = models.JSONField(default=list, help_text="List of deployment IDs for this platform")
    enable_nrps = models.BooleanField(default=True, help_text="Enable Names and Role Provisioning Service")
    enable_deep_linking = models.BooleanField(default=True, help_text="Enable Deep Linking 2.0")

    auto_create_categories = models.BooleanField(default=True, help_text="Automatically create categories for courses")
    auto_create_users = models.BooleanField(default=True, help_text="Automatically create users on first launch")
    auto_sync_roles = models.BooleanField(default=True, help_text="Automatically sync user roles from LTI")
    remove_from_groups_on_unenroll = models.BooleanField(default=False, help_text="Remove users from RBAC groups when they're no longer in the course")

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    active = models.BooleanField(default=True, help_text="Whether this platform is currently active")

    class Meta:
        verbose_name = 'LTI Platform'
        verbose_name_plural = 'LTI Platforms'
        unique_together = [['platform_id', 'client_id']]

    def __str__(self):
        return f"{self.name} ({self.platform_id})"

    def get_lti_config(self):
        """Return configuration dict for PyLTI1p3"""
        return {
            'platform_id': self.platform_id,
            'client_id': self.client_id,
            'auth_login_url': self.auth_login_url,
            'auth_token_url': self.auth_token_url,
            'auth_audience': self.auth_audience,
            'key_set_url': self.key_set_url,
            'key_set': self.key_set,
            'deployment_ids': self.deployment_ids,
        }


class LTIResourceLink(models.Model):
    """Specific LTI resource link (e.g., MediaCMS in a Moodle course)"""

    platform = models.ForeignKey(LTIPlatform, on_delete=models.CASCADE, related_name='resource_links')

    # LTI context (course)
    context_id = models.CharField(max_length=255, db_index=True, help_text="LTI context ID (typically course ID)")
    context_title = models.CharField(max_length=255, blank=True, help_text="Course title")
    context_label = models.CharField(max_length=100, blank=True, help_text="Course short name/code")

    # Resource link
    resource_link_id = models.CharField(max_length=255, db_index=True, help_text="LTI resource link ID")
    resource_link_title = models.CharField(max_length=255, blank=True, help_text="Resource link title")

    # MediaCMS mappings
    category = models.ForeignKey('files.Category', on_delete=models.SET_NULL, null=True, blank=True, related_name='lti_resource_links', help_text="Mapped MediaCMS category")
    rbac_group = models.ForeignKey('rbac.RBACGroup', on_delete=models.SET_NULL, null=True, blank=True, related_name='lti_resource_links', help_text="RBAC group for course members")

    class Meta:
        verbose_name = 'LTI Resource Link'
        verbose_name_plural = 'LTI Resource Links'
        unique_together = [['platform', 'context_id', 'resource_link_id']]
        indexes = [
            models.Index(fields=['platform', 'context_id']),
            models.Index(fields=['context_id']),
        ]

    def __str__(self):
        return f"{self.context_title or self.context_id} - {self.resource_link_title or self.resource_link_id}"


class LTIUserMapping(models.Model):
    """Maps LTI user identities (sub claim) to MediaCMS users"""

    platform = models.ForeignKey(LTIPlatform, on_delete=models.CASCADE, related_name='user_mappings')
    lti_user_id = models.CharField(max_length=255, db_index=True, help_text="LTI 'sub' claim (unique user identifier from platform)")
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='lti_mappings')

    created_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'LTI User Mapping'
        verbose_name_plural = 'LTI User Mappings'
        unique_together = [['platform', 'lti_user_id']]
        indexes = [
            models.Index(fields=['platform', 'lti_user_id']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"{self.user.username} ({self.platform.name})"


class LTIRoleMapping(models.Model):
    """Maps LTI institutional roles to MediaCMS roles"""

    GLOBAL_ROLE_CHOICES = [('advancedUser', 'Advanced User'), ('editor', 'MediaCMS Editor'), ('manager', 'MediaCMS Manager'), ('admin', 'MediaCMS Administrator')]

    GROUP_ROLE_CHOICES = [('member', 'Member'), ('contributor', 'Contributor'), ('manager', 'Manager')]

    platform = models.ForeignKey(LTIPlatform, on_delete=models.CASCADE, related_name='role_mappings')
    lti_role = models.CharField(max_length=255, help_text="LTI role URI or short name (e.g., 'Instructor', 'Learner')")

    # Global role (optional)
    global_role = models.CharField(max_length=20, blank=True, choices=GLOBAL_ROLE_CHOICES, help_text="MediaCMS global role to assign")

    # Group role for RBAC
    group_role = models.CharField(max_length=20, blank=True, choices=GROUP_ROLE_CHOICES, help_text="RBAC group role to assign")

    class Meta:
        verbose_name = 'LTI Role Mapping'
        verbose_name_plural = 'LTI Role Mappings'
        unique_together = [['platform', 'lti_role']]

    def __str__(self):
        return f"{self.lti_role} → {self.global_role or 'none'}/{self.group_role or 'none'} ({self.platform.name})"


class LTILaunchLog(models.Model):
    """Audit log for LTI launches"""

    LAUNCH_TYPE_CHOICES = [
        ('resource_link', 'Resource Link Launch'),
        ('deep_linking', 'Deep Linking'),
    ]

    platform = models.ForeignKey(LTIPlatform, on_delete=models.CASCADE, related_name='launch_logs')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, null=True, blank=True, related_name='lti_launch_logs', help_text="MediaCMS user (null if launch failed before user creation)")
    resource_link = models.ForeignKey(LTIResourceLink, on_delete=models.SET_NULL, null=True, blank=True, related_name='launch_logs')

    launch_type = models.CharField(max_length=50, choices=LAUNCH_TYPE_CHOICES, default='resource_link')

    success = models.BooleanField(default=True, db_index=True, help_text="Whether the launch was successful")
    error_message = models.TextField(blank=True, help_text="Error message if launch failed")
    claims = models.JSONField(help_text="Sanitized LTI claims from the launch")

    ip_address = models.GenericIPAddressField(null=True, blank=True, help_text="IP address of the user")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'LTI Launch Log'
        verbose_name_plural = 'LTI Launch Logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['platform', 'user']),
        ]

    def __str__(self):
        status = "✓" if self.success else "✗"
        user_str = self.user.username if self.user else "Unknown"
        return f"{status} {user_str} @ {self.platform.name} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"
