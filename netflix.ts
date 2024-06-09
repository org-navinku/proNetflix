import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as config from "./config";

// Create a security group for allowing SSH access and all outbound traffic
const securityGroup = new aws.ec2.SecurityGroup(config.netflixenv, {
    vpcId: config.vpcid,
    ingress: [
        {
            protocol: "tcp",
            fromPort: 22,
            toPort: 22,
            cidrBlocks: ["0.0.0.0/0"],
            description: "Allow SSH access"
        },
        {
            protocol: "tcp",
            fromPort: 8080,
            toPort: 8080,
            cidrBlocks: ["0.0.0.0/0"],
            description: "Allow port 8080 for Jenkins"
        },
        {
            protocol: "tcp",
            fromPort: 80,
            toPort: 80,
            cidrBlocks: ["0.0.0.0/0"],
            description: "Allow HTTP access"
        },
        {
            protocol: "tcp",
            fromPort: 443,
            toPort: 443,
            cidrBlocks: ["0.0.0.0/0"],
            description: "Allow HTTPS access"
        }
    ],
    egress: [
        {
            protocol: "-1",
            fromPort: 0,
            toPort: 0,
            cidrBlocks: ["0.0.0.0/0"],
            description: "Allow all outbound traffic"
        },
    ],
    tags: {
        Name: config.ec2netflix,
        Environment: config.netflixenv,
    },
});

// Create an EC2 instance with the defined key pair and volumes
const ec2Instance = new aws.ec2.Instance(config.netflixenv, {
    ami: config.imageid, // replace with the AMI ID of your choice
    instanceType: config.instanceType,
    keyName: config.keypair,
    rootBlockDevice: {
        volumeSize: config.rtvolumeSize,
        deleteOnTermination: true,
        volumeType: "gp3",
        tags: {
            Name: config.ec2netflix,
            Environment: config.netflixenv,
        },
    },
    ebsBlockDevices: [{
        deviceName: "/dev/sdb",
        volumeSize: config.dtvolumeSize,
        deleteOnTermination: true,
        volumeType: "gp3",
        tags: {
            Name: config.ec2netflix,
            Environment: config.netflixenv,
        },
    }],
    vpcSecurityGroupIds: [securityGroup.id],
    subnetId: config.subnetid,
    associatePublicIpAddress: true,
    userData: pulumi.interpolate`#!/bin/bash
    sudo apt-get update
    sudo wget -O /usr/share/keyrings/jenkins-keyring.asc \
      https://pkg.jenkins.io/debian/jenkins.io-2023.key
    echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc]" \
      https://pkg.jenkins.io/debian binary/ | sudo tee \
      /etc/apt/sources.list.d/jenkins.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y openjdk-17-jre-headless
    sudo apt-get install jenkins -y
    sudo systemctl enable jenkins
    sudo systemctl start jenkins
    sudo apt-get update
    sudo apt-get install docker.io -y
    sudo usermod -aG docker $USER
    sudo chmod 777 /var/run/docker.sock
    newgrp docker
    sudo systemctl enable docker
    sudo systemctl start docker
    `,
    tags: {
        Name: config.ec2netflix,
        Environment: config.netflixenv,
    },
});

// mkdir -p /home/ubuntu/.ssh
//     echo '${config.sshkey}' >> /home/ubuntu/.ssh/authorized_keys
//     chown ubuntu:ubuntu /home/ubuntu/.ssh/authorized_keys
//     chmod 600 /home/ubuntu/.ssh/authorized_keys

// echo $(sudo cat /var/lib/jenkins/secrets/initialAdminPassword)

// Export the public IP and instance ID of the EC2 instance
export const ec2netflixpubIp = ec2Instance.publicIp;
export const ec2netflixInstanceId = ec2Instance.id;

// Export the Jenkins admin URL using the public DNS of the EC2 instance
export const ec2netflixJenkinsAdminUrl = pulumi.interpolate`http://${ec2Instance.publicDns}:8080`;