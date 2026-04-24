package com.aipartner;

import io.quarkus.runtime.Quarkus;
import io.quarkus.runtime.QuarkusApplication;
import io.quarkus.runtime.annotations.QuarkusMain;

@QuarkusMain
public class AiLifePartnerApplication implements QuarkusApplication {

    public static void main(String[] args) {
        Quarkus.run(AiLifePartnerApplication.class, args);
    }

    @Override
    public int run(String... args) {
        Quarkus.waitForExit();
        return 0;
    }
}