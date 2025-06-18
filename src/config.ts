const Config = {
  server: {
    userConfigApiUrl:
      process.env.ENVIRONMENT === "development"
        ? "https://dev.config.realty-ai.com/dev/user_config_api"
        : "https://config.realty-ai.com/user_config_api",
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
