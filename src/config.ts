const Config = {
  server: {
    userConfigApiUrl:
      "https://vshdvtqafk.execute-api.us-east-2.amazonaws.com/default/user_config_api",
  },
  bot: {
    defaultAvatarSrc:
      "https://cdn.realty-ai.com/chat/images/default_avatar.png",
    socketTimeout: 60000,
  },
  theme: {
    messages: {
      bot: {
        defaultBackgroundColor: "#f3f3f3",
        defaultTextColor: "#303235",
      },
      user: {
        defaultBackgroundColor: "#3B81F6",
        defaultTextColor: "#ffffff",
      },
    },
    popoutMessage: {
      defaultBackgroundColor: "#f3f3f3",
    },
  },
};

export default Config;
