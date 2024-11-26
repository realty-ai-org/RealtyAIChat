const Config = {
  server: {
    userConfigApiUrl:
      "https://vshdvtqafk.execute-api.us-east-2.amazonaws.com/default/user_config_api",
    messageCollectorApiUrl:
      "https://kqg01i5ba6.execute-api.us-east-2.amazonaws.com/default/message_collector",
  },
  bot: {
    defaultAvatarSrc:
      "https://cdn.jsdelivr.net/gh/realty-ai-org/RealtyAIChat@main/images/default_avatar.png",
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
